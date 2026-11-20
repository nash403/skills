import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PrRef } from '../../types'
import { prKey } from './refs'

// What runs now, so the pane can say so. The module's own set guards against a second run: an atom read is async, so
// two clicks could both find it free. The atom outlives a reload while the set does not, so `clearBusy` empties it
// when the module starts.
const busyWork = atom({ plugin: 'nash403-skills', key: 'babysitBusy' } as const, [])
const running = new Set<string>()

export type BusyKind = 'fetch' | 'approval' | 'resolve-all' | 'post' | 'resolve'

export function busyKey(kind: BusyKind, ref: PrRef, threadId?: string) {
  return [kind, prKey(ref), threadId].filter(part => part !== undefined).join(' ')
}

// Runs `work` unless the same key runs already; resolves whether it ran.
export async function runOnce($: EngineInterface, key: string, work: () => Promise<void>) {
  if (running.has(key)) {
    return false
  }

  running.add(key)
  await update($, busyWork, keys => [...keys.filter(busy => busy !== key), key])

  try {
    await work()
  } finally {
    running.delete(key)
    await update($, busyWork, keys => keys.filter(busy => busy !== key))
  }

  return true
}

// Read while drawing, this subscribes the drawing to it.
export async function readBusy($: EngineInterface): Promise<ReadonlySet<string>> {
  return new Set(await read($, busyWork))
}

export async function clearBusy($: EngineInterface) {
  await update($, busyWork, () => [])
}
