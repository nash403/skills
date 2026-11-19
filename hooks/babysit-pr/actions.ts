import type { EngineInterface } from 'claude-code'

import type { PrApproval, PrRef, PrSnapshot } from '../../types'
import { clearDraft, dropThreadDraft } from './drafted'
import { refreshPr } from './followed'
import { approvePr, markThreadResolved, postReply, unapprovePr } from './platform'
import { fixPrompt, replyPrompt, reviewChangesArgs } from './prompts'
import type { ThreadTarget } from './prompts'
import { prKey, prLabel } from './refs'

// The pr-review skill, run as a slash command: the skill is the user's to start, not the model's.
const PR_REVIEW_COMMAND = 'nash403-skills:pr-review'

// Writes running now, so a second click doesn't send one twice. Keyed by what the write acts on.
const pendingWrites = new Set<string>()

async function writeOnce(key: string, write: () => Promise<void>) {
  if (pendingWrites.has(key)) {
    return
  }

  pendingWrites.add(key)

  try {
    await write()
  } finally {
    pendingWrites.delete(key)
  }
}

function threadWriteKey(kind: 'post' | 'resolve', { ref, thread }: ThreadTarget) {
  return `${kind} ${prKey(ref)} ${thread.id}`
}

function threadMention({ ref, thread, name }: ThreadTarget) {
  return `review thread ${name === null ? thread.id : `${name} (${thread.id})`} on ${prLabel(ref)}`
}

// A click that acts without a prompt leaves a note, so the agent doesn't redo it: the model reads it at its next request.
async function noteForSession($: EngineInterface, text: string) {
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
}

export async function askFix($: EngineInterface, target: ThreadTarget) {
  await $.prompt.submit({ text: fixPrompt(target), asUser: true })
}

export async function askReply($: EngineInterface, target: ThreadTarget) {
  await $.prompt.submit({ text: replyPrompt(target), asUser: true })
}

async function postAndClear($: EngineInterface, target: ThreadTarget, body: string) {
  const posted = await postReply($, target.ref, target.thread.id, body)

  if (!posted.isOk) {
    $.ui.toast(`Could not post the reply: ${posted.reason}`)
    return
  }

  await clearDraft($, target.ref, target.thread.id, body)
  await noteForSession($, `The user posted your draft reply in ${threadMention(target)} from the /babysit-pr pane. Don't post it again. It reads:\n\n${body}`)
  await refreshPr($, target.ref)
}

// `body` is the draft the user saw when they clicked.
export async function postDraft($: EngineInterface, target: ThreadTarget, body: string) {
  await writeOnce(threadWriteKey('post', target), () => postAndClear($, target, body))
}

export async function discardDraft($: EngineInterface, target: ThreadTarget, body: string) {
  await clearDraft($, target.ref, target.thread.id, body)
  await noteForSession($, `The user discarded your draft reply to ${threadMention(target)} in the /babysit-pr pane. Don't post it.`)
}

async function resolveAndRefresh($: EngineInterface, target: ThreadTarget) {
  const resolved = await markThreadResolved($, target.ref, target.thread.id)

  if (!resolved.isOk) {
    $.ui.toast(`Could not resolve the thread: ${resolved.reason}`)
    return
  }

  await dropThreadDraft($, target.ref, target.thread.id)
  await noteForSession($, `The user resolved ${threadMention(target)} from the /babysit-pr pane.`)
  await refreshPr($, target.ref)
}

export async function resolveThread($: EngineInterface, target: ThreadTarget) {
  await writeOnce(threadWriteKey('resolve', target), () => resolveAndRefresh($, target))
}

async function approveAndRefresh($: EngineInterface, ref: PrRef, headSha: string) {
  const approved = await approvePr($, ref, headSha)

  if (!approved.isOk) {
    $.ui.toast(`Could not approve: ${approved.reason}`)
    return
  }

  await noteForSession($, `The user approved ${prLabel(ref)} from the /babysit-pr pane.`)
  await refreshPr($, ref)
}

async function unapproveAndRefresh($: EngineInterface, ref: PrRef, approval: PrApproval) {
  const withdrawn = await unapprovePr($, ref, approval)

  if (!withdrawn.isOk) {
    $.ui.toast(`Could not withdraw the approval: ${withdrawn.reason}`)
    return
  }

  await noteForSession($, `The user withdrew their approval of ${prLabel(ref)} from the /babysit-pr pane.`)
  await refreshPr($, ref)
}

// `headSha` is the head the pane showed when the user clicked.
export async function approve($: EngineInterface, ref: PrRef, headSha: string) {
  await writeOnce(`approval ${prKey(ref)}`, () => approveAndRefresh($, ref, headSha))
}

export async function unapprove($: EngineInterface, ref: PrRef, approval: PrApproval) {
  await writeOnce(`approval ${prKey(ref)}`, () => unapproveAndRefresh($, ref, approval))
}

export async function askReviewChanges($: EngineInterface, ref: PrRef, pr: PrSnapshot, fromSha: string) {
  try {
    await $.command.run({ command: PR_REVIEW_COMMAND, args: reviewChangesArgs(ref, pr, fromSha) })
  } catch (error) {
    $.ui.toast(`Could not start /${PR_REVIEW_COMMAND}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
