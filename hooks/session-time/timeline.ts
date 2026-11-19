// Splits a session's time, from the first prompt to the last answer, into what it was spent on, read from the
// transcript's timestamps. Each stretch between two entries goes to one slice, chosen by the entry that ends it and the
// tool calls still waiting at that point.

import type { Slice, SessionTime } from '../../types'

// Tool calls the agent blocks on: a foreground subagent, or a question to the person.
const WAITS: Record<string, Slice> = {
  Agent: 'agents',
  Task: 'agents',
  AskUserQuestion: 'you',
  ExitPlanMode: 'you',
}

// User rows the engine writes itself: a local command's output, and the note of an interruption.
const ENGINE_TEXT = /^(<local-command-|\[Request interrupted)/
const PERSONS_META = /^(<local-command-caveat>|Continue from where you left off\.)/

export type Timeline = {
  time: SessionTime
  // The last instant accounted for.
  at: number | null
  // Time since the last answer: it counts once another answer comes, the total stopping at the last one.
  pending: Record<Slice, number>
  // Wait calls not answered yet, by tool_use id.
  waits: Record<string, Slice>
}

type Block = { type?: string; id?: string; name?: string; input?: { run_in_background?: boolean }; tool_use_id?: string; text?: string }

type Entry = {
  type?: string
  timestamp?: string
  isSidechain?: boolean
  isMeta?: boolean
  isCompactSummary?: boolean
  origin?: { kind?: string }
  message?: { content?: string | Block[] }
}

type Kind = 'prompt' | 'wake' | 'step' | 'answer'

export function emptySlices(): Record<Slice, number> {
  return { work: 0, agents: 0, you: 0, idle: 0 }
}

export function newTimeline(): Timeline {
  return { time: { startedAt: null, endedAt: null, ms: emptySlices() }, at: null, pending: emptySlices(), waits: {} }
}

function textOf(content: string | Block[] | undefined) {
  if (typeof content === 'string') {
    return content
  }

  return (content ?? []).map(block => block.text ?? '').join('')
}

function kindOf(entry: Entry): Kind | null {
  if (entry.type === 'assistant') {
    return 'answer'
  }

  if (entry.type !== 'user') {
    return null
  }

  const origin = entry.origin?.kind

  if (origin === 'human') {
    return 'prompt'
  }

  if (origin !== undefined) {
    return 'wake'
  }

  // Typed slash commands, and prompts sent through other entrypoints (an SDK, an older version), carry no origin.
  const content = entry.message?.content

  // Written ahead of a local command's output (`/model`, `/clear`), or when the person resumes a session: their
  // doing, flagged meta.
  if (PERSONS_META.test(textOf(content))) {
    return 'prompt'
  }

  const hasResult = Array.isArray(content) && content.some(block => block.type === 'tool_result')
  const isEngines = entry.isMeta || entry.isCompactSummary || ENGINE_TEXT.test(textOf(content))

  return hasResult || isEngines ? 'step' : 'prompt'
}

function sliceUntil(kind: Kind, waits: Record<string, Slice>): Slice {
  const waiting = Object.values(waits)

  if (waiting.includes('you')) {
    return 'you'
  }

  if (kind === 'prompt') {
    return 'idle'
  }

  // The agent was woken by a background task, a subagent's most often, or another session.
  if (kind === 'wake' || waiting.includes('agents')) {
    return 'agents'
  }

  return 'work'
}

function noteWaits(waits: Record<string, Slice>, content: string | Block[] | undefined) {
  for (const block of Array.isArray(content) ? content : []) {
    const slice = block.name ? WAITS[block.name] : undefined

    if (block.type === 'tool_use' && block.id && slice && !(slice === 'agents' && block.input?.run_in_background)) {
      waits[block.id] = slice
    }

    if (block.type === 'tool_result' && block.tool_use_id) {
      delete waits[block.tool_use_id]
    }
  }
}

function addEntry(timeline: Timeline, entry: Entry) {
  const kind = kindOf(entry)
  const stamp = entry.timestamp ? Date.parse(entry.timestamp) : NaN

  if (kind === null || entry.isSidechain || Number.isNaN(stamp)) {
    return
  }

  if (timeline.at === null) {
    if (kind !== 'prompt') {
      return
    }

    timeline.time.startedAt = stamp
    timeline.at = stamp
  }

  // Entries are written in order, but their stamps may step back a little.
  const at = Math.max(stamp, timeline.at)
  timeline.pending[sliceUntil(kind, timeline.waits)] += at - timeline.at
  timeline.at = at

  if (kind === 'prompt') {
    timeline.waits = {}
  }

  noteWaits(timeline.waits, entry.message?.content)

  if (kind === 'answer') {
    for (const slice of Object.keys(timeline.pending) as Slice[]) {
      timeline.time.ms[slice] += timeline.pending[slice]
    }

    timeline.pending = emptySlices()
    timeline.time.endedAt = at
  }
}

// Reads complete JSONL lines into the timeline; a line that does not parse is skipped.
export function addLines(timeline: Timeline, lines: readonly string[]) {
  for (const line of lines) {
    if (!line.includes('"timestamp"')) {
      continue
    }

    try {
      addEntry(timeline, JSON.parse(line))
    } catch {
      // A torn or foreign line: nothing to count.
    }
  }
}

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60_000)

  if (ms < 60_000) {
    return `${Math.round(ms / 1000)}s`
  }

  if (minutes < 60) {
    return `${minutes}m`
  }

  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

// Shares `width` cells between the slices by largest remainder, giving at least one to any slice that took time.
export function cells(ms: Record<Slice, number>, width: number): Record<Slice, number> {
  const slices = Object.keys(ms) as Slice[]
  const total = slices.reduce((sum, slice) => sum + ms[slice], 0)
  const shares = emptySlices()

  if (total <= 0 || width <= 0) {
    return shares
  }

  const exact = slices.map(slice => ({ slice, value: (ms[slice] / total) * width }))

  for (const { slice, value } of exact) {
    shares[slice] = ms[slice] > 0 ? Math.max(1, Math.floor(value)) : 0
  }

  const used = () => slices.reduce((sum, slice) => sum + shares[slice], 0)
  const byRemainder = exact
    .filter(({ slice }) => ms[slice] > 0)
    .sort((a, b) => (b.value % 1) - (a.value % 1))
    .map(({ slice }) => slice)

  for (let index = 0; used() < width; index += 1) {
    shares[byRemainder[index % byRemainder.length] as Slice] += 1
  }

  while (used() > width) {
    const widest = slices.reduce((a, b) => (shares[a] >= shares[b] ? a : b))
    shares[widest] -= 1
  }

  return shares
}
