import type { CodeHead, PrChange, PrComment, PrSnapshot, PrThread } from '../../types'
import { concerningThreads, isMentioned, isViewerPr, threadsLabel } from './turns'

type ThreadChange = Extract<PrChange, { kind: 'replied' | 'mentioned' }>

type ApprovalChange = Extract<PrChange, { kind: 'approved' | 'unapproved' }>

export type ReadChanges = { changes: PrChange[]; codeHead: CodeHead | null }

const CODE_PUSHED: PrChange = { kind: 'code-pushed' }

const THREADS_RESOLVED: PrChange = { kind: 'threads-resolved' }

function codeHeadOf(pr: PrSnapshot): CodeHead | null {
  const patchId = pr.heads.findLast(head => head.sha === pr.headSha)?.patchId ?? null

  return patchId === null ? null : { sha: pr.headSha, patchId, baseBranch: pr.baseBranch }
}

// Only on a peer's PR: on the viewer's own, they pushed it. Patch-ids are taken against the base, so a base change
// compares nothing.
function isCodePushed(next: PrSnapshot, from: CodeHead | null, to: CodeHead | null) {
  if (isViewerPr(next) || from === null || to === null || from.baseBranch !== to.baseBranch) {
    return false
  }

  return from.patchId !== to.patchId
}

function isThreadChange(change: PrChange): change is ThreadChange {
  return change.kind === 'replied' || change.kind === 'mentioned'
}

function isApprovalChange(change: PrChange): change is ApprovalChange {
  return change.kind === 'approved' || change.kind === 'unapproved'
}

// One change per kind and author, its threads joined; replies before mentions.
function groupThreadChanges(changes: readonly ThreadChange[]): ThreadChange[] {
  const grouped = new Map<string, ThreadChange>()

  for (const change of changes) {
    const key = `${change.kind} ${change.author}`
    const threadIds = grouped.get(key)?.threadIds ?? []
    grouped.set(key, { ...change, threadIds: [...new Set([...threadIds, ...change.threadIds])] })
  }

  const groups = [...grouped.values()]

  return [...groups.filter(change => change.kind === 'replied'), ...groups.filter(change => change.kind === 'mentioned')]
}

function newMessagesFromOthers(previous: PrSnapshot, next: PrSnapshot, thread: PrThread): PrComment[] {
  const readUrls = new Set(previous.threads.find(old => old.id === thread.id)?.comments.map(comment => comment.url))

  return thread.comments.filter(comment => !readUrls.has(comment.url) && comment.author !== next.viewer)
}

// New messages by others in the open threads that concern the viewer. On the viewer's PR a new thread is one too.
function threadChanges(previous: PrSnapshot, next: PrSnapshot): ThreadChange[] {
  const concerning = new Set(concerningThreads(next).map(({ thread }) => thread.id))
  const newMessages = next.threads.filter(thread => concerning.has(thread.id)).flatMap(thread =>
    newMessagesFromOthers(previous, next, thread).map(
      (comment): ThreadChange => ({
        kind: isMentioned(comment.body, next.viewer) ? 'mentioned' : 'replied',
        author: comment.author,
        threadIds: [thread.id],
      }),
    ),
  )

  return groupThreadChanges(newMessages)
}

// On a peer's PR, the viewer's threads that were open are all resolved now, at least one by someone else.
function isAllResolved(previous: PrSnapshot, next: PrSnapshot) {
  const wereOpen = new Set(concerningThreads(previous).map(({ thread }) => thread.id))

  if (isViewerPr(next) || wereOpen.size === 0 || concerningThreads(next).length > 0) {
    return false
  }

  return next.threads.some(thread => wereOpen.has(thread.id) && thread.isResolved && thread.resolvedBy !== next.viewer)
}

function approvalChanges(previous: PrSnapshot, next: PrSnapshot): ApprovalChange[] {
  const approvers = (pr: PrSnapshot) => pr.approvals.map(({ user }) => user).filter(user => user !== next.viewer)
  const before = approvers(previous)
  const after = approvers(next)

  return [
    ...after.filter(user => !before.includes(user)).map((user): ApprovalChange => ({ kind: 'approved', user })),
    ...before.filter(user => !after.includes(user)).map((user): ApprovalChange => ({ kind: 'unapproved', user })),
  ]
}

// What changed between two reads of a PR, by someone other than the viewer. `previous` is null on a PR's first read,
// which raises nothing. `codeHead` is the one the last read left; the result carries the next one.
export function detectChanges(previous: PrSnapshot | null, next: PrSnapshot, codeHead: CodeHead | null): ReadChanges {
  const readCodeHead = codeHeadOf(next)
  const changes: PrChange[] =
    previous === null
      ? []
      : [
          ...(isCodePushed(next, codeHead, readCodeHead) ? [CODE_PUSHED] : []),
          ...threadChanges(previous, next),
          ...(isAllResolved(previous, next) ? [THREADS_RESOLVED] : []),
          ...approvalChanges(previous, next),
        ]

  return { changes, codeHead: readCodeHead ?? codeHead }
}

// Per approver, the newest news wins.
function newestApprovalChanges(changes: readonly ApprovalChange[]) {
  const byUser = new Map<string, ApprovalChange>()

  for (const change of changes) {
    byUser.delete(change.user)
    byUser.set(change.user, change)
  }

  return [...byUser.values()]
}

export function mergeChanges(older: readonly PrChange[], newer: readonly PrChange[]): PrChange[] {
  const all = [...older, ...newer]

  return [
    ...(all.some(change => change.kind === 'code-pushed') ? [CODE_PUSHED] : []),
    ...groupThreadChanges(all.filter(isThreadChange)),
    ...(all.some(change => change.kind === 'threads-resolved') ? [THREADS_RESOLVED] : []),
    ...newestApprovalChanges(all.filter(isApprovalChange)),
  ]
}

export function changeText(change: PrChange) {
  switch (change.kind) {
    case 'code-pushed':
      return 'Code pushed since your review'
    case 'replied':
      return `@${change.author} replied on ${threadsLabel(change.threadIds.length)}`
    case 'mentioned':
      return `@${change.author} mentioned you in ${threadsLabel(change.threadIds.length)}`
    case 'threads-resolved':
      return 'All your threads are resolved'
    case 'approved':
      return `@${change.user} approved`
    case 'unapproved':
      return `@${change.user} withdrew their approval`
  }
}

export function changesToast(prLabel: string, changes: readonly PrChange[]) {
  return `${prLabel}: ${changes.map(changeText).join(' · ')}`
}
