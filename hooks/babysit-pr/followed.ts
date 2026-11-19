import { atom, read, update } from 'claude-code'
import type { EngineInterface, SessionMessage } from 'claude-code'

import type { FollowedPr, PrRef, PrSnapshot } from '../../types'
import { fetchSnapshot, findCurrentBranchPr, findCurrentRepo } from './platform'
import { findBashPrs, findSessionPrs, parsePrInput, parsePrUrl, prKey, uniquePrs } from './refs'

const followedPrs = atom({ plugin: 'nash403-skills', key: 'babysitPrs' } as const, [], { shape: 'prs-3' })
const selectedPr = atom({ plugin: 'nash403-skills', key: 'babysitSelectedPr' } as const, null)
// PRs removed by hand: what the session shows again doesn't bring them back, only a manual add.
const removedPrs = atom({ plugin: 'nash403-skills', key: 'babysitRemovedPrs' } as const, [], { shape: 'removed-1' })
const scannedMessage = atom({ plugin: 'nash403-skills', key: 'babysitScannedMessage' } as const, null)
// The plugin loads in every session: nothing reads the session or calls gh or glab until /babysit-pr has run once.
const isOptedIn = atom({ plugin: 'nash403-skills', key: 'isBabysitPrOptedIn' } as const, false)

const MESSAGES_PER_SCAN = 4096

// Read while drawing, this subscribes the drawing to both values.
export async function readFollowedPrs($: EngineInterface) {
  const prs = await read($, followedPrs)
  const selected = await read($, selectedPr)

  return { prs, selectedIndex: Math.max(0, prs.findIndex(pr => prKey(pr.ref) === selected)) }
}

// A PR the pane follows and has read, named by its URL as the pane's tools take it.
export async function findLoadedPr($: EngineInterface, url: string): Promise<{ ref: PrRef; snapshot: PrSnapshot } | null> {
  const ref = parsePrUrl(url)

  if (!ref) {
    return null
  }

  const key = prKey(ref)
  const snapshot = (await read($, followedPrs)).find(pr => prKey(pr.ref) === key)?.snapshot

  return snapshot ? { ref, snapshot } : null
}

export function notLoadedDenial(url: string) {
  return { deny: `${url} is not a PR the /babysit-pr pane follows, or it has not loaded yet.` }
}

export async function optIn($: EngineInterface) {
  await update($, isOptedIn, () => true)
}

export async function hasOptedIn($: EngineInterface) {
  return read($, isOptedIn)
}

const fetching = new Set<string>()

async function refetch($: EngineInterface, refs: readonly PrRef[]) {
  const idle = refs.filter(ref => !fetching.has(prKey(ref)))
  idle.forEach(ref => fetching.add(prKey(ref)))

  await Promise.all(
    idle.map(async ref => {
      const key = prKey(ref)

      try {
        const snapshot = await fetchSnapshot($, ref)
        await update($, followedPrs, list => list.map(pr => (prKey(pr.ref) === key ? { ...pr, snapshot, error: null } : pr)))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        await update($, followedPrs, list => list.map(pr => (prKey(pr.ref) === key ? { ...pr, error: reason } : pr)))
      } finally {
        fetching.delete(key)
      }
    }),
  )
}

// Merged and closed PRs stay in the switcher but are no longer polled.
export async function refreshOpenPrs($: EngineInterface) {
  const list = await read($, followedPrs)
  const open = list.filter(pr => pr.snapshot === null || pr.snapshot.state === 'open')

  await refetch($, open.map(pr => pr.ref))
}

export async function refreshPr($: EngineInterface, ref: PrRef) {
  await refetch($, [ref])
}

// Adds the PRs not followed yet, unread: the caller refreshes them.
async function follow($: EngineInterface, refs: readonly PrRef[]) {
  await update($, followedPrs, list => {
    const known = new Set(list.map(pr => prKey(pr.ref)))
    const added = uniquePrs(refs).filter(ref => !known.has(prKey(ref)))

    return [...list, ...added.map((ref): FollowedPr => ({ ref, snapshot: null, error: null }))]
  })
}

async function followFound($: EngineInterface, refs: readonly PrRef[]) {
  const removed = await read($, removedPrs)

  await follow($, refs.filter(ref => !removed.includes(prKey(ref))))
}

export async function followByHand($: EngineInterface, input: string) {
  const parsed = parsePrInput(input, await findCurrentRepo($))

  if ('error' in parsed) {
    $.ui.toast(parsed.error)
    return
  }

  const key = prKey(parsed.ref)
  await update($, removedPrs, keys => keys.filter(removedKey => removedKey !== key))
  await update($, selectedPr, () => key)
  await follow($, [parsed.ref])
  await refetch($, [parsed.ref])
}

export async function unfollow($: EngineInterface, ref: PrRef) {
  const key = prKey(ref)
  const list = await read($, followedPrs)
  const index = list.findIndex(pr => prKey(pr.ref) === key)
  const neighbour = list[index + 1] ?? list[index - 1]

  await update($, removedPrs, keys => [...keys, key])
  await update($, followedPrs, prs => prs.filter(pr => prKey(pr.ref) !== key))
  await update($, selectedPr, () => (neighbour ? prKey(neighbour.ref) : null))
}

export async function select($: EngineInterface, ref: PrRef) {
  await update($, selectedPr, () => prKey(ref))
}

async function readNewestMessages($: EngineInterface) {
  return $.session.messages({ last: MESSAGES_PER_SCAN })
}

// Reads on from the last message scanned; a mark that is gone (a compaction) reads the newest messages again.
async function readNewMessages($: EngineInterface): Promise<SessionMessage[]> {
  const after = await read($, scannedMessage)
  const sinceMark = after === null ? await readNewestMessages($) : await $.session.messages({ after })
  const messages = 'deny' in sinceMark ? await readNewestMessages($) : sinceMark

  if ('deny' in messages) {
    return []
  }

  const lastUuid = messages.at(-1)?.uuid

  if (lastUuid !== undefined) {
    await update($, scannedMessage, () => lastUuid)
  }

  return messages
}

// PRs and MRs the session shows: URLs in its messages, gh and glab PR commands, and the current branch's PR.
export async function followSessionPrs($: EngineInterface) {
  const repo = await findCurrentRepo($)
  const branchPr = repo ? await findCurrentBranchPr($, repo) : null
  const found = findSessionPrs(await readNewMessages($), repo)

  await followFound($, branchPr ? [branchPr, ...found] : found)
}

export async function followCommandPrs($: EngineInterface, command: string, output: string) {
  await followFound($, findBashPrs(command, output, await findCurrentRepo($)))
}
