import type { PrComment, PrSnapshot, PrThread } from '../../types'
import { headCommittedAt, isPushedSinceApproval } from './rules'

// Whose turn an unresolved thread is. On the viewer's PR: `reply` or `theirs` (the reviewers').
// On a peer's PR: `author-replied`, `mentioned` or `pushed` since the viewer's last message, else `theirs` (the author's).
export type ThreadTurn = 'reply' | 'author-replied' | 'mentioned' | 'pushed' | 'theirs'

export type ConcerningThread = { thread: PrThread; firstComment: PrComment; turn: ThreadTurn }

export type NextStep = { actor: 'You' | 'Reviewers' | 'Author'; action: string }

const EXCERPT_LENGTH = 80

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GitLab usernames hold dots, so `@ana.b` names someone else while `@ana.` ends a sentence.
export function isMentioned(body: string, login: string) {
  return new RegExp(`(?<![\\w@.])@${escapeRegExp(login)}(?![\\w-]|\\.[\\w-])`, 'i').test(body)
}

export function excerpt(body: string) {
  const line = body.replace(/\s+/g, ' ').trim()

  if (line.length <= EXCERPT_LENGTH) {
    return line
  }

  return `${line.slice(0, EXCERPT_LENGTH - 1).replace(/\s+\S*$/, '')}…`
}

export function isViewerTurn(turn: ThreadTurn) {
  return turn !== 'theirs'
}

export function isViewerPr(pr: PrSnapshot) {
  return pr.author === pr.viewer
}

function postedAt(comment: PrComment) {
  return Date.parse(comment.createdAt)
}

function concernsViewer(pr: PrSnapshot, thread: PrThread) {
  return isViewerPr(pr) || thread.comments.some(comment => comment.author === pr.viewer || isMentioned(comment.body, pr.viewer))
}

function peerThreadTurn(pr: PrSnapshot, thread: PrThread): ThreadTurn {
  const viewerTimes = thread.comments.filter(comment => comment.author === pr.viewer).map(postedAt)

  if (viewerTimes.length === 0) {
    return 'mentioned'
  }

  const lastViewerAt = Math.max(...viewerTimes)
  const laterComments = thread.comments.filter(comment => postedAt(comment) > lastViewerAt)

  if (laterComments.some(comment => comment.author === pr.author)) {
    return 'author-replied'
  }

  if (laterComments.some(comment => isMentioned(comment.body, pr.viewer))) {
    return 'mentioned'
  }

  const committedAt = headCommittedAt(pr)

  return committedAt !== null && committedAt > lastViewerAt ? 'pushed' : 'theirs'
}

function threadTurn(pr: PrSnapshot, thread: PrThread): ThreadTurn {
  if (!isViewerPr(pr)) {
    return peerThreadTurn(pr, thread)
  }

  return thread.comments.at(-1)?.author === pr.viewer ? 'theirs' : 'reply'
}

// The unresolved threads that concern the viewer, the viewer's turn first. A thread with no comment left (GitLab
// system notes only) has nothing to show and is left out.
export function concerningThreads(pr: PrSnapshot): ConcerningThread[] {
  const concerning = pr.threads.flatMap(thread => {
    const firstComment = thread.comments[0]

    if (thread.isResolved || firstComment === undefined || !concernsViewer(pr, thread)) {
      return []
    }

    return [{ thread, firstComment, turn: threadTurn(pr, thread) }]
  })

  return [...concerning.filter(item => isViewerTurn(item.turn)), ...concerning.filter(item => !isViewerTurn(item.turn))]
}

export function threadsLabel(count: number) {
  return count === 1 ? '1 thread' : `${count} threads`
}

function countTurns(concerning: readonly ConcerningThread[], turn: ThreadTurn) {
  return concerning.filter(item => item.turn === turn).length
}

function viewerPrSteps(pr: PrSnapshot): NextStep[] {
  const concerning = concerningThreads(pr)
  const toReply = countTurns(concerning, 'reply')
  const waiting = countTurns(concerning, 'theirs')
  const steps: NextStep[] = []

  if (toReply > 0) {
    steps.push({ actor: 'You', action: `reply to ${threadsLabel(toReply)}` })
  }

  if (waiting > 0) {
    steps.push({ actor: 'Reviewers', action: `${threadsLabel(waiting)} ${waiting === 1 ? 'waits' : 'wait'} for them` })
  }

  if (concerning.length === 0 && !pr.isApproved) {
    // On GitHub the author's replies in threads are reviews too.
    const isReviewed = pr.threads.length > 0 || pr.approvals.length > 0 || pr.reviews.some(review => review.author !== pr.author)
    steps.push({ actor: 'Reviewers', action: isReviewed ? 'approve, no open thread' : 'not reviewed yet' })
  }

  return steps
}

// The viewer's newest review: GitHub lists them oldest first, GitLab keeps one per reviewer.
function lastViewerReview(pr: PrSnapshot) {
  return pr.reviews.filter(review => review.author === pr.viewer).at(-1)
}

// On a peer's PR with no open thread of the viewer's and no approval from them: what their threads and reviews call for.
function settledPeerStep(pr: PrSnapshot): NextStep {
  const hasViewerThreads = pr.threads.some(thread => concernsViewer(pr, thread))
  const review = lastViewerReview(pr)
  const committedAt = headCommittedAt(pr)

  if (!review && !hasViewerThreads) {
    return { actor: 'You', action: 'not reviewed yet' }
  }

  if (review?.submittedAt && committedAt !== null && committedAt > Date.parse(review.submittedAt)) {
    return { actor: 'You', action: 'code pushed since your review' }
  }

  if (hasViewerThreads) {
    return { actor: 'You', action: 'ready to approve, all your threads resolved' }
  }

  if (review?.state === 'changes-requested') {
    return { actor: 'Author', action: 'address your review' }
  }

  return { actor: 'You', action: 'ready to approve' }
}

function peerPrSteps(pr: PrSnapshot): NextStep[] {
  const concerning = concerningThreads(pr)
  const authorReplied = countTurns(concerning, 'author-replied')
  const mentioned = countTurns(concerning, 'mentioned')
  const unanswered = countTurns(concerning, 'theirs')
  const hasViewerApproved = pr.approvals.some(approval => approval.user === pr.viewer)
  const steps: NextStep[] = []

  if (authorReplied > 0) {
    steps.push({ actor: 'You', action: `the author replied on ${authorReplied} of your threads` })
  }

  if (mentioned > 0) {
    steps.push({ actor: 'You', action: `mentioned in ${threadsLabel(mentioned)}` })
  }

  if (countTurns(concerning, 'pushed') > 0 || isPushedSinceApproval(pr)) {
    steps.push({ actor: 'You', action: 'code pushed since your review' })
  }

  if (concerning.length === 0 && !hasViewerApproved) {
    steps.push(settledPeerStep(pr))
  }

  if (unanswered > 0) {
    steps.push({ actor: 'Author', action: `${unanswered} of your threads unanswered` })
  }

  return steps
}

// Who acts next on an open PR and on what, the viewer's turn first.
export function nextSteps(pr: PrSnapshot): NextStep[] {
  if (pr.state !== 'open') {
    return []
  }

  return isViewerPr(pr) ? viewerPrSteps(pr) : peerPrSteps(pr)
}
