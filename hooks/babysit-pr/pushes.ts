import type { PrComment, PrHead, PrSnapshot, ReviewPoint } from '../../types'

// Was code pushed since someone looked at the PR, or only a rebase? A rebase keeps the patch-id of the PR's diff.

export function headCommittedAt(pr: PrSnapshot) {
  const head = pr.commits.find(commit => commit.sha === pr.headSha) ?? pr.commits.at(-1)

  return head ? Date.parse(head.committedAt) : null
}

export function viewerApproval(pr: PrSnapshot) {
  return pr.approvals.find(({ user }) => user === pr.viewer)
}

export function newestPoint(points: readonly ReviewPoint[]) {
  return points.reduce<ReviewPoint | null>((newest, point) => (!newest || Date.parse(point.at) > Date.parse(newest.at) ? point : newest), null)
}

export function commentPoint(comment: PrComment): ReviewPoint {
  return { at: comment.createdAt, headSha: comment.headSha }
}

function headWithSha(pr: PrSnapshot, sha: string): PrHead {
  return pr.heads.findLast(head => head.sha === sha) ?? { sha, pushedAt: null, patchId: null }
}

// The head a review or comment was made on: the one GitHub names, else the newest GitLab version pushed before it.
export function headAt(pr: PrSnapshot, { at, headSha }: ReviewPoint): PrHead | null {
  if (headSha !== null) {
    return headWithSha(pr, headSha)
  }

  const time = Date.parse(at)

  return pr.heads.findLast(head => head.pushedAt !== null && Date.parse(head.pushedAt) <= time) ?? null
}

// A head whose patch-id is unknown counts as changed.
function isCodeChangedSince(pr: PrSnapshot, seen: PrHead) {
  if (seen.sha === pr.headSha) {
    return false
  }

  const current = headWithSha(pr, pr.headSha)

  return seen.patchId === null || current.patchId === null || seen.patchId !== current.patchId
}

export function isCodeChangedFrom(pr: PrSnapshot, sha: string) {
  return isCodeChangedSince(pr, headWithSha(pr, sha))
}

// With no head known at that point (no version that old), the head commit date decides.
export function isCodePushedSince(pr: PrSnapshot, point: ReviewPoint) {
  const seen = headAt(pr, point)

  if (seen !== null) {
    return isCodeChangedSince(pr, seen)
  }

  const committedAt = headCommittedAt(pr)

  return committedAt !== null && committedAt > Date.parse(point.at)
}

// On a peer's open PR, the head of the viewer's last review or comment when code was pushed since: Review changes
// reviews from there.
export function headToReviewFrom(pr: PrSnapshot) {
  if (pr.state !== 'open' || pr.author === pr.viewer || pr.lastViewerActivity === null) {
    return null
  }

  const seen = headAt(pr, pr.lastViewerActivity)

  return seen !== null && isCodeChangedSince(pr, seen) ? seen.sha : null
}

function newestComment(comments: readonly PrComment[]) {
  return comments.reduce<PrComment | undefined>(
    (newest, comment) => (!newest || Date.parse(comment.createdAt) > Date.parse(newest.createdAt) ? comment : newest),
    undefined,
  )
}

export function newestThreadComment(pr: PrSnapshot) {
  return newestComment(pr.threads.flatMap(thread => thread.comments))
}

export function lastViewerComment(pr: PrSnapshot, comments: readonly PrComment[]) {
  return newestComment(comments.filter(comment => comment.author === pr.viewer))
}

// GitHub has no push history, so its patch-ids are read for these heads only: the current one, and those the rules
// compare it with (the viewer's approval, last review or comment and last message per open thread, the newest comment).
export function comparedHeadShas(pr: PrSnapshot) {
  const approval = viewerApproval(pr)
  const openThreadComments = pr.threads.filter(thread => !thread.isResolved).map(thread => lastViewerComment(pr, thread.comments))
  const shas = [
    pr.headSha,
    approval && 'sha' in approval ? approval.sha : null,
    pr.lastViewerActivity?.headSha,
    newestThreadComment(pr)?.headSha,
    ...openThreadComments.map(comment => comment?.headSha),
  ]

  return [...new Set(shas.filter((sha): sha is string => typeof sha === 'string'))]
}

// `git patch-id --stable` prints `<patch-id> <commit>`, or nothing for an empty diff.
export function parsePatchId(output: string) {
  return output.trim().split(/\s+/)[0] || null
}
