import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PrRef, PrSnapshot, PrWatch } from '../../types'
import { changesToast, detectChanges, mergeChanges } from './changes'
import { prKey, prLabel } from './refs'

// The changes found between reads, by PR key, until the user has seen them in the pane.
const watches = atom({ plugin: 'nash403-skills', key: 'babysitWatches' } as const, {}, { shape: 'watches-1' })

const UNWATCHED: PrWatch = { codeHead: null, changes: [], isShown: false }

const CHANGES_TOAST_MS = 8_000

// Read while drawing, this subscribes the drawing to every PR's changes.
export async function readWatches($: EngineInterface) {
  return read($, watches)
}

export function hasUnseenChanges(watch: PrWatch | undefined) {
  return watch !== undefined && watch.changes.length > 0 && !watch.isShown
}

// Compares a PR's new read with the one it replaces, and toasts what changed: one toast per read. Changes that land
// while the pane shows the PR count as shown.
export async function recordRead($: EngineInterface, ref: PrRef, previous: PrSnapshot | null, next: PrSnapshot, { isOnScreen }: { isOnScreen: boolean }) {
  const key = prKey(ref)
  // Read apart from the update below: only this function writes `codeHead`, and a PR is read once at a time.
  const { changes, codeHead } = detectChanges(previous, next, (await read($, watches))[key]?.codeHead ?? null)

  await update($, watches, byPr => {
    const watch = byPr[key] ?? UNWATCHED

    if (changes.length === 0) {
      return { ...byPr, [key]: { ...watch, codeHead } }
    }

    return { ...byPr, [key]: { codeHead, changes: mergeChanges(watch.changes, changes), isShown: isOnScreen } }
  })

  if (changes.length > 0) {
    $.ui.toast(changesToast(prLabel(ref), changes), { timeoutMs: CHANGES_TOAST_MS })
  }
}

// Applies `edit` to a PR that has changes; leaves the others alone.
async function updateChanged($: EngineInterface, key: string, edit: (watch: PrWatch) => PrWatch) {
  await update($, watches, byPr => {
    const watch = byPr[key]

    return watch && watch.changes.length > 0 ? { ...byPr, [key]: edit(watch) } : byPr
  })
}

function seen(watch: PrWatch): PrWatch {
  return { ...watch, changes: [], isShown: false }
}

// The pane shows the PR. The first time, its `•` goes and its changes stay drawn; shown again, they are seen.
export async function markShown($: EngineInterface, key: string) {
  await updateChanged($, key, watch => (watch.isShown ? seen(watch) : { ...watch, isShown: true }))
}

// The user acted on the PR in the pane.
export async function clearChanges($: EngineInterface, key: string) {
  await updateChanged($, key, seen)
}

export async function forgetPr($: EngineInterface, key: string) {
  await update($, watches, ({ [key]: _, ...rest }) => rest)
}
