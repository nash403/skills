import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'nash403-skills',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const TRANSCRIPT = '/home/me/.claude/projects/app/session.jsonl'

function line(minute: number, entry: Record<string, unknown>) {
  const stamp = new Date(Date.UTC(2026, 10, 19, 10, 0) + minute * 60_000).toISOString()

  return `${JSON.stringify({ ...entry, timestamp: stamp })}\n`
}

// 10 minutes of work, then 20 minutes before the next prompt, answered a minute later. The last line is still being
// written.
const CONTENT = [
  line(0, { type: 'user', origin: { kind: 'human' }, message: { content: 'go' } }),
  line(10, { type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } }),
  line(30, { type: 'user', origin: { kind: 'human' }, message: { content: 'again' } }),
  line(31, { type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } }),
  '{"type":"assistant","timest',
].join('')

test('a line with the total and the idle share unfolds into each slice taken', async ($, on) => {
  const reads = stubEngine(on, CONTENT)

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(BAND)

  expect((await ui.find({ key: 'session-time' }))?.text).toBe('▸ ⏱ 31m · idle 65%')
  expect(await ui.find({ type: 'Text', text: /■ agent/ })).toBeUndefined()

  await ui.press({ key: 'session-time' })

  expect((await ui.find({ key: 'session-time' }))?.text).toBe('▾ ⏱ 31m · idle 65%')
  expect((await ui.find({ type: 'Text', text: /■ agent/ }))?.text).toBe('■ agent 11m 35%')
  expect((await ui.find({ type: 'Text', text: /■ idle/ }))?.text).toBe('■ idle 20m 65%')
  expect(await ui.find({ type: 'Text', text: /subagents/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /waiting on you/ })).toBeUndefined()
  expect(reads.every(read => read.path === TRANSCRIPT)).toBe(true)

  await ui.press({ key: 'session-time' })

  expect(await ui.find({ type: 'Text', text: /■ agent/ })).toBeUndefined()
  await ui.unmount()
})

test('no gauge before the first answer', async ($, on) => {
  stubEngine(on, line(0, { type: 'user', origin: { kind: 'human' }, message: { content: 'go' } }))

  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ key: 'session-time' })).toBeUndefined()
  await ui.unmount()
})

function stubEngine(on: any, content: string) {
  const reads: { path: string; offset?: number; length?: number }[] = []

  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work/app' }))
  on('session.info', () => ({ value: { transcriptPath: TRANSCRIPT } }))
  on('clock.every', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }))
  on('fs.stat', () => ({ value: { kind: 'file', size: content.length, mtimeMs: 0, isLink: false } }))
  on('fs.read', (_: unknown, e: { path: string; offset?: number; length?: number }) => {
    reads.push(e)
    const offset = e.offset ?? 0

    return { value: content.slice(offset, e.length === undefined ? undefined : offset + e.length) }
  })

  return reads
}
