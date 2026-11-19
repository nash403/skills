import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, RenderInput } from 'claude-code'

import type { Slice } from '../../types'
import { addLines, cells, formatDuration, newTimeline } from './timeline'

const sessionTime = atom({ plugin: 'nash403-skills', key: 'sessionTime' } as const, null, { shape: 'time-1' })

const EVERY_MS = 15_000
const CHUNK_BYTES = 4 * 1024 * 1024

// Left to right, as the gauge reads.
const SLICES: readonly Slice[] = ['work', 'agents', 'you', 'idle']
const LOOK: Record<Slice, { label: string; color: Color; cell: string }> = {
  work: { label: 'agent', color: 'claude', cell: '█' },
  agents: { label: 'subagents', color: 'merged', cell: '█' },
  you: { label: 'you', color: 'suggestion', cell: '█' },
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

// The gauge row, or null before the first answer.
export async function drawSessionTime($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const time = await read($, sessionTime)

  if (time === null || time.startedAt === null || time.endedAt === null || time.endedAt <= time.startedAt) {
    return null
  }

  const { Box, Text } = $.ui.resolve(e)
  const total = time.endedAt - time.startedAt
  const shown = SLICES.filter(slice => time.ms[slice] > 0)
  const legend = shown.map(slice => {
    const percent = Math.round((time.ms[slice] / total) * 100)

    return { slice, text: `${LOOK[slice].label} ${formatDuration(time.ms[slice])}`, percent: `${percent}%` }
  })
  const totalText = `⏱ ${formatDuration(total)}`
  const legendWidth = legend.reduce((sum, item) => sum + item.text.length + item.percent.length + 5, 0)
  const width = Math.max(10, Math.min(48, e.props.bodyColumns - totalText.length - legendWidth - 4))
  const shares = cells(time.ms, width)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} width="100%">
      <Text bold>{totalText}</Text>
      <Text>
        {SLICES.map(slice => (
          <Text color={LOOK[slice].color}>{LOOK[slice].cell.repeat(shares[slice])}</Text>
        ))}
      </Text>
      {legend.map(({ slice, text, percent }) => (
        <Text>
          <Text color={LOOK[slice].color}>■</Text> {text} <Text dimColor>{percent}</Text>
        </Text>
      ))}
    </Box>
  )
}
