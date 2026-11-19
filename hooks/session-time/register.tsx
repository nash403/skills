import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, RenderInput } from 'claude-code'

import type { Slice } from '../../types'
import { addLines, cells, formatDuration, newTimeline } from './timeline'

const sessionTime = atom({ plugin: 'nash403-skills', key: 'sessionTime' } as const, null, { shape: 'time-1' })
const isSessionTimeOpen = atom({ plugin: 'nash403-skills', key: 'isSessionTimeOpen' } as const, false)

const EVERY_MS = 15_000
const CHUNK_BYTES = 4 * 1024 * 1024

// Left to right, as the gauge reads.
const SLICES: readonly Slice[] = ['work', 'agents', 'you', 'idle']
const LOOK: Record<Slice, { label: string; color: Color; cell: string }> = {
  work: { label: 'agent', color: 'claude', cell: '█' },
  agents: { label: 'subagents', color: 'merged', cell: '█' },
  you: { label: 'waiting on you', color: 'suggestion', cell: '█' },
  idle: { label: 'idle', color: 'inactive', cell: '░' },
}

// The transcript is read on from where the last read stopped; a reload starts over.
let timeline = newTimeline()
let source = { path: '', offset: 0 }
let running: Promise<void> | null = null

function utf8Length(text: string) {
  let bytes = 0

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }

  return bytes
}

async function readOn($: EngineInterface) {
  const { transcriptPath } = await $.session.info()
  const { size } = await $.fs.stat(transcriptPath)

  if (transcriptPath !== source.path || size < source.offset) {
    timeline = newTimeline()
    source = { path: transcriptPath, offset: 0 }
  }

  let length = CHUNK_BYTES

  while (source.offset < size) {
    const wanted = Math.min(length, size - source.offset)
    const text = await $.fs.read(transcriptPath, { offset: source.offset, length: wanted })
    const end = text.lastIndexOf('\n')

    if (end < 0) {
      // One line longer than the chunk: read it whole next time round, or wait for its end.
      if (wanted < length) {
        break
      }

      length *= 2
      continue
    }

    const whole = text.slice(0, end + 1)
    addLines(timeline, whole.split('\n'))
    source.offset += utf8Length(whole)
  }

  const { time } = timeline
  await update($, sessionTime, () => ({ ...time, ms: { ...time.ms } }))
}

async function refresh($: EngineInterface) {
  while (running) {
    await running
  }

  running = readOn($)

  try {
    await running
  } catch (error) {
    $.ui.log(`session-time: refresh failed: ${String(error)}`, { to: 'debug' })
  } finally {
    running = null
  }
}

export function startSessionTime($: EngineInterface) {
  void refresh($)
  $.clock.every(EVERY_MS, () => void refresh($))
}

export function refreshSessionTimeAfterTurn($: EngineInterface) {
  void refresh($)
}

function percentOf(ms: number, total: number) {
  return `${Math.round((ms / total) * 100)}%`
}

// One quiet line, the total and the idle share; a click unfolds the gauge and each slice under it.
export async function drawSessionTime($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const time = await read($, sessionTime)

  if (time === null || time.startedAt === null || time.endedAt === null || time.endedAt <= time.startedAt) {
    return null
  }

  const { Box, Button, Text } = $.ui.resolve(e)
  const total = time.endedAt - time.startedAt
  const isOpen = await read($, isSessionTimeOpen)
  const summary = (
    <Button key="session-time" plain dimColor={!isOpen} onPress={() => void update($, isSessionTimeOpen, open => !open)}>
      {isOpen ? '▾' : '▸'} ⏱ {formatDuration(total)} · idle {percentOf(time.ms.idle, total)}
    </Button>
  )

  if (!isOpen) {
    return summary
  }

  const shares = cells(time.ms, Math.max(10, Math.min(60, e.props.bodyColumns - 2)))

  return (
    <Box flexDirection="column" width="100%">
      {summary}
      <Box paddingLeft={2}>
        <Text>
          {SLICES.map(slice => (
            <Text color={LOOK[slice].color}>{LOOK[slice].cell.repeat(shares[slice])}</Text>
          ))}
        </Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} paddingLeft={2}>
        {SLICES.filter(slice => time.ms[slice] > 0).map(slice => (
          <Text>
            <Text color={LOOK[slice].color}>■</Text> {LOOK[slice].label} {formatDuration(time.ms[slice])}{' '}
            <Text dimColor>{percentOf(time.ms[slice], total)}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}
