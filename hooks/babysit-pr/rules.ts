import type { BlockedReason, CiState, PrSnapshot } from '../../types'
import { commentPoint, isCodeChangedFrom, isCodePushedSince, newestThreadComment, viewerApproval } from './pushes'

export type JobOutcome = 'passed' | 'failed' | 'running' | 'waiting'

export type StatusChip =
  | 'merged'
  | 'closed'
  | 'approved'
  | 'approved + threads'
  | 'updated'
  | 'reviewed'
  | 'resolved'
  | 'opened'

export type Participant = { name: string; role: 'author' | 'reviewer'; hasApproved: boolean; hasCommits: boolean }

// Jobs are `null` when the head commit has no CI at all.
export function ciState(jobs: readonly JobOutcome[] | null): CiState {
  if (jobs === null) {
    return 'none'
  }

  if (jobs.includes('failed')) {
    return 'error'
  }

  const isRunning = jobs.some(job => job === 'running' || job === 'waiting')

  if (!isRunning) {
    return 'ok'
  }

  return jobs.includes('passed') ? 'pending' : 'starting'
}

export function isSkipCi(title: string, headMessage: string) {
  return /\[(skip ci|ci skip)\]/i.test(`${title}\n${headMessage}`)
}

type GithubMergeFacts = {
  mergeStateStatus: string
  reviewDecision: string | null
  ci: CiState
  openThreads: number
}

// GitHub's BLOCKED gives no reason, so it is inferred from the review decision, the checks, then the threads.
export function githubBlockedReason({ mergeStateStatus, reviewDecision, ci, openThreads }: GithubMergeFacts): BlockedReason | null {
  if (mergeStateStatus === 'DIRTY') {
    return 'conflicts'
  }

  if (mergeStateStatus === 'BEHIND') {
    return 'rebase'
  }

  if (mergeStateStatus !== 'BLOCKED') {
    return null
  }

  if (reviewDecision === 'REVIEW_REQUIRED' || reviewDecision === 'CHANGES_REQUESTED') {
    return 'approvals'
  }

  if (ci === 'error' || ci === 'starting' || ci === 'pending') {
    return 'checks'
  }

  return openThreads > 0 ? 'threads' : 'blocked'
}

const GITLAB_BLOCKED_REASONS: Record<string, BlockedReason | null> = {
  MERGEABLE: null,
  CHECKING: null,
  UNCHECKED: null,
  PREPARING: null,
  DRAFT_STATUS: null,
  NOT_OPEN: null,
  CONFLICT: 'conflicts',
  NEED_REBASE: 'rebase',
  NOT_APPROVED: 'approvals',
  REQUESTED_CHANGES: 'approvals',
  DISCUSSIONS_NOT_RESOLVED: 'threads',
  CI_STILL_RUNNING: 'checks',
  CI_MUST_PASS: 'checks',
  EXTERNAL_STATUS_CHECKS: 'checks',
}

export function gitlabBlockedReason(detailedMergeStatus: string): BlockedReason | null {
  const reason = GITLAB_BLOCKED_REASONS[detailedMergeStatus]

  return reason === undefined ? 'blocked' : reason
}

export function threadCounts({ threads }: PrSnapshot) {
  return { open: threads.filter(thread => !thread.isResolved).length, total: threads.length }
}

// Code pushed after the newest comment, a rebase alone left out.
function isUpdatedSinceLastComment(pr: PrSnapshot) {
  const comment = newestThreadComment(pr)

  return comment !== undefined && isCodePushedSince(pr, commentPoint(comment))
}

export function statusChip(pr: PrSnapshot): StatusChip {
  if (pr.state !== 'open') {
    return pr.state
  }

  const { open, total } = threadCounts(pr)

  if (pr.isApproved) {
    return open > 0 ? 'approved + threads' : 'approved'
  }

  if (isUpdatedSinceLastComment(pr)) {
    return 'updated'
  }

  if (open > 0) {
    return 'reviewed'
  }

  return total > 0 ? 'resolved' : 'opened'
}

// On a peer's PR the viewer approved: was code pushed since, a rebase alone left out?
export function isPushedSinceApproval(pr: PrSnapshot) {
  const approval = viewerApproval(pr)

  if (pr.state !== 'open' || pr.author === pr.viewer || approval === undefined) {
    return false
  }

  if ('sha' in approval && approval.sha !== null) {
    return isCodeChangedFrom(pr, approval.sha)
  }

  return approval.approvedAt !== null && isCodePushedSince(pr, { at: approval.approvedAt, headSha: null })
}

export function participants(pr: PrSnapshot): Participant[] {
  const commenters = pr.threads.flatMap(thread => thread.comments.map(comment => comment.author))
  const approvers = pr.approvals.map(approval => approval.user)
  const reviewers = [...new Set([...pr.reviewers, ...approvers, ...commenters])].filter(name => name !== pr.author)

  return [pr.author, ...reviewers].map(name => ({
    name,
    role: name === pr.author ? 'author' : 'reviewer',
    hasApproved: approvers.includes(name),
    hasCommits: pr.commits.some(commit => commit.author === name),
  }))
}
