import type { EngineInterface } from 'claude-code'

import { clearDraft, dropThreadDraft } from './drafted'
import { refreshPr } from './followed'
import { markThreadResolved, postReply } from './platform'
import { fixPrompt, replyPrompt } from './prompts'
import type { ThreadTarget } from './prompts'
import { prKey, prLabel } from './refs'

// Writes running now, so a second click on Post or Resolve doesn't send it twice.
const pendingWrites = new Set<string>()

async function writeOnce(kind: 'post' | 'resolve', { ref, thread }: ThreadTarget, write: () => Promise<void>) {
  const key = `${kind} ${prKey(ref)} ${thread.id}`

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

function threadMention({ ref, thread, name }: ThreadTarget) {
  return `review thread ${name === null ? thread.id : `${name} (${thread.id})`} on ${prLabel(ref)}`
}

// Every click the agent could redo or propose leaves a note: the model reads it at its next request.
async function noteForSession($: EngineInterface, text: string) {
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
}

export async function askFix($: EngineInterface, target: ThreadTarget) {
  await noteForSession($, `From the /babysit-pr pane, the user asked you to fix ${threadMention(target)}.`)
  await $.prompt.submit({ text: fixPrompt(target), asUser: true })
}

export async function askReply($: EngineInterface, target: ThreadTarget) {
  await noteForSession($, `From the /babysit-pr pane, the user asked you to draft a reply to ${threadMention(target)}.`)
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
  await writeOnce('post', target, () => postAndClear($, target, body))
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
  await writeOnce('resolve', target, () => resolveAndRefresh($, target))
}
