import type { EngineInterface } from 'claude-code'

import type { PrApproval, PrRef, PrSnapshot, PrThread } from '../../types'
import { busyKey, runOnce } from './busy'
import { clearDraft, dropThreadDraft } from './drafted'
import { refreshPr } from './followed'
import { approvePr, markThreadResolved, postReply, unapprovePr } from './platform'
import { fixPrompt, replyPrompt, reviewChangesArgs } from './prompts'
import type { ThreadTarget } from './prompts'
import { prLabel } from './refs'
import { threadsLabel } from './turns'

// The pr-review skill, run as a slash command: the skill is the user's to start, not the model's.
const PR_REVIEW_COMMAND = 'nash403-skills:pr-review'

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

  $.ui.toast('Reply posted')
  await clearDraft($, target.ref, target.thread.id, body)
  await noteForSession($, `The user posted your draft reply in ${threadMention(target)} from the /babysit-pr pane. Don't post it again. It reads:\n\n${body}`)
  await refreshPr($, target.ref)
}

// `body` is the draft the user saw when they clicked.
export async function postDraft($: EngineInterface, target: ThreadTarget, body: string) {
  await runOnce($, busyKey('post', target.ref, target.thread.id), () => postAndClear($, target, body))
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

  $.ui.toast('Thread resolved')
  await dropThreadDraft($, target.ref, target.thread.id)
  await noteForSession($, `The user resolved ${threadMention(target)} from the /babysit-pr pane.`)
  await refreshPr($, target.ref)
}

export async function resolveThread($: EngineInterface, target: ThreadTarget) {
  await runOnce($, busyKey('resolve', target.ref, target.thread.id), () => resolveAndRefresh($, target))
}

// One by one, so a failure says which thread it was and the others still resolve.
async function resolveEach($: EngineInterface, ref: PrRef, threads: readonly PrThread[]) {
  const failures: string[] = []
  let resolved = 0

  for (const thread of threads) {
    const result = await markThreadResolved($, ref, thread.id)

    if (result.isOk) {
      resolved += 1
      await dropThreadDraft($, ref, thread.id)
    } else {
      failures.push(result.reason)
    }
  }

  $.ui.toast(failures.length === 0 ? `${threadsLabel(resolved)} resolved` : `Resolved ${resolved} of ${threads.length}: ${failures[0]}`)

  if (resolved > 0) {
    await noteForSession($, `The user resolved ${threadsLabel(resolved)} of theirs on ${prLabel(ref)} from the /babysit-pr pane.`)
    await refreshPr($, ref)
  }
}

// `threads` are the open threads the pane showed when the user clicked.
export async function resolveAll($: EngineInterface, ref: PrRef, threads: readonly PrThread[]) {
  await runOnce($, busyKey('resolve-all', ref), () => resolveEach($, ref, threads))
}

async function approveAndRefresh($: EngineInterface, ref: PrRef, headSha: string) {
  const approved = await approvePr($, ref, headSha)

  if (!approved.isOk) {
    $.ui.toast(`Could not approve: ${approved.reason}`)
    return
  }

  $.ui.toast(`Approved ${prLabel(ref)}`)
  await noteForSession($, `The user approved ${prLabel(ref)} from the /babysit-pr pane.`)
  await refreshPr($, ref)
}

async function unapproveAndRefresh($: EngineInterface, ref: PrRef, approval: PrApproval) {
  const withdrawn = await unapprovePr($, ref, approval)

  if (!withdrawn.isOk) {
    $.ui.toast(`Could not withdraw the approval: ${withdrawn.reason}`)
    return
  }

  $.ui.toast(`Approval withdrawn on ${prLabel(ref)}`)
  await noteForSession($, `The user withdrew their approval of ${prLabel(ref)} from the /babysit-pr pane.`)
  await refreshPr($, ref)
}

// `headSha` is the head the pane showed when the user clicked.
export async function approve($: EngineInterface, ref: PrRef, headSha: string) {
  await runOnce($, busyKey('approval', ref), () => approveAndRefresh($, ref, headSha))
}

export async function unapprove($: EngineInterface, ref: PrRef, approval: PrApproval) {
  await runOnce($, busyKey('approval', ref), () => unapproveAndRefresh($, ref, approval))
}

export async function askReviewChanges($: EngineInterface, ref: PrRef, pr: PrSnapshot, fromSha: string) {
  try {
    await $.command.run({ command: PR_REVIEW_COMMAND, args: reviewChangesArgs(ref, pr, fromSha) })
  } catch (error) {
    $.ui.toast(`Could not start /${PR_REVIEW_COMMAND}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
