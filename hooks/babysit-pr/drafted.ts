import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PrRef, ReplyDrafts } from '../../types'
import { parseReplyDraftInput, withDraft, withoutDraft, withoutThreadDraft } from './drafts'
import { findLoadedPr, notLoadedDenial } from './followed'
import { prKey, prLabel } from './refs'
import { concerningThreads } from './turns'

// The draft replies the model wrote through its tool, by PR key then thread id. They outlive a refresh of the PR.
const replyDrafts = atom({ plugin: 'nash403-skills', key: 'babysitReplyDrafts' } as const, {}, { shape: 'drafts-1' })

async function updatePrDrafts($: EngineInterface, ref: PrRef, change: (drafts: ReplyDrafts) => ReplyDrafts) {
  const key = prKey(ref)

  await update($, replyDrafts, all => ({ ...all, [key]: change(all[key] ?? {}) }))
}

// Read while drawing, this subscribes the drawing to the drafts.
export async function readPrDrafts($: EngineInterface, ref: PrRef) {
  return (await read($, replyDrafts))[prKey(ref)] ?? {}
}

export async function saveReplyDraft($: EngineInterface, input: unknown): Promise<{ result: string } | { deny: string }> {
  const parsed = parseReplyDraftInput(input)

  if ('errors' in parsed) {
    return { deny: parsed.errors.join('\n') }
  }

  const loaded = await findLoadedPr($, parsed.prUrl)

  if (!loaded) {
    return notLoadedDenial(parsed.prUrl)
  }

  const { ref, snapshot } = loaded

  // The pane draws a draft only under a thread it lists.
  if (!concerningThreads(snapshot).some(({ thread }) => thread.id === parsed.threadId)) {
    return { deny: `${parsed.threadId} is not one of the open threads the /babysit-pr pane lists on ${prLabel(ref)}.` }
  }

  await updatePrDrafts($, ref, drafts => withDraft(drafts, parsed.threadId, parsed.body))

  return { result: `The draft reply is under thread ${parsed.threadId} in the /babysit-pr pane. The user posts or discards it from there.` }
}

export async function dropThreadDraft($: EngineInterface, ref: PrRef, threadId: string) {
  await updatePrDrafts($, ref, drafts => withoutThreadDraft(drafts, threadId))
}

export async function clearDraft($: EngineInterface, ref: PrRef, threadId: string, body: string) {
  await updatePrDrafts($, ref, drafts => withoutDraft(drafts, threadId, body))
}
