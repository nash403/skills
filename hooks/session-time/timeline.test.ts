import { expect, test } from 'claude-code/testing'

import { addLines, cells, formatDuration, newTimeline } from './timeline'

const MINUTE = 60_000

// A transcript line at 10:00 plus `minute`.
function at(minute: number, entry: Record<string, unknown>) {
  const stamp = new Date(Date.UTC(2026, 10, 19, 10, 0) + minute * MINUTE).toISOString()

  return JSON.stringify({ ...entry, timestamp: stamp })
}

const prompt = (minute: number) => at(minute, { type: 'user', origin: { kind: 'human' }, message: { content: 'go' } })
const answer = (minute: number, ...content: unknown[]) =>
  at(minute, { type: 'assistant', message: { content: content.length ? content : [{ type: 'text', text: 'done' }] } })
const call = (id: string, name: string, input: Record<string, unknown> = {}) => ({ type: 'tool_use', id, name, input })
const result = (minute: number, id: string) =>
  at(minute, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } })

// Two turns: the first works, waits on a subagent, then on the person's answer; the second starts a background
// subagent and is woken by its notification. A third prompt has no answer yet.
const SESSION = [
  at(-5, { type: 'user', isMeta: true, message: { content: 'before the first prompt' } }),
  prompt(0),
  answer(1, call('b1', 'Bash')),
  result(2, 'b1'),
  answer(3, call('a1', 'Agent')),
  at(8, { type: 'assistant', isSidechain: true, message: { content: 'inside the subagent' } }),
  result(13, 'a1'),
  answer(14, call('q1', 'AskUserQuestion')),
  result(20, 'q1'),
  answer(22),
  prompt(52),
  answer(53, call('a2', 'Agent', { run_in_background: true })),
  result(54, 'a2'),
  answer(55),
  at(65, { type: 'user', origin: { kind: 'task-notification' }, message: { content: '<task-notification>' } }),
  answer(66),
  '{"type":"assistant","timestamp": torn',
  prompt(90),
]

test('splits the time from the first prompt to the last answer', () => {
  const timeline = newTimeline()
  addLines(timeline, SESSION)

  expect(timeline.time.endedAt! - timeline.time.startedAt!).toBe(66 * MINUTE)
  expect(timeline.time.ms).toEqual({ work: 10 * MINUTE, agents: 20 * MINUTE, you: 6 * MINUTE, idle: 30 * MINUTE })
})

test('reads the same whatever the lines come in batches of', () => {
  const timeline = newTimeline()

  for (const line of SESSION) {
    addLines(timeline, [line])
  }

  expect(timeline.time.ms).toEqual({ work: 10 * MINUTE, agents: 20 * MINUTE, you: 6 * MINUTE, idle: 30 * MINUTE })
})

test('a stamp that steps back counts nothing', () => {
  const timeline = newTimeline()
  addLines(timeline, [prompt(0), answer(4), result(3, 'x'), answer(5)])

  expect(timeline.time.ms.work).toBe(5 * MINUTE)
})

test('a typed slash command starts a turn like a prompt', () => {
  const timeline = newTimeline()
  addLines(timeline, [
    prompt(0),
    answer(1),
    at(11, { type: 'user', message: { content: '<command-message>deslop</command-message>' } }),
    answer(12),
  ])

  expect(timeline.time.ms).toEqual({ work: 2 * MINUTE, agents: 0, you: 0, idle: 10 * MINUTE })
})

test('formats durations', () => {
  expect(formatDuration(42_000)).toBe('42s')
  expect(formatDuration(12 * MINUTE)).toBe('12m')
  expect(formatDuration(66 * MINUTE)).toBe('1h06')
})

test('shares the gauge cells, at least one for any slice that took time', () => {
  const shares = cells({ work: 100, agents: 0, you: 1, idle: 899 }, 20)

  expect(shares.work + shares.agents + shares.you + shares.idle).toBe(20)
  expect(shares).toEqual({ work: 2, agents: 0, you: 1, idle: 17 })
  expect(cells({ work: 0, agents: 0, you: 0, idle: 0 }, 20)).toEqual({ work: 0, agents: 0, you: 0, idle: 0 })
})

test('rows with no origin: a prompt from another entrypoint, a local command or a resume end idle time; the engine notes do not', () => {
  const timeline = newTimeline()
  const user = (minute: number, entry: Record<string, unknown>) => at(minute, { type: 'user', ...entry })
  addLines(timeline, [
    user(0, { message: { content: [{ type: 'text', text: 'sent through the SDK' }] } }),
    answer(1),
    user(11, { isMeta: true, message: { content: '<local-command-caveat>Caveat: the messages below' } }),
    user(11, { message: { content: '<local-command-stdout>Set model</local-command-stdout>' } }),
    user(31, { isMeta: true, message: { content: [{ type: 'text', text: 'Continue from where you left off.' }] } }),
    answer(32),
    user(33, { message: { content: '[Request interrupted by user]' } }),
    user(34, { isCompactSummary: true, message: { content: 'This session is being continued' } }),
    answer(35),
  ])

  expect(timeline.time.ms).toEqual({ work: 5 * MINUTE, agents: 0, you: 0, idle: 30 * MINUTE })
})
