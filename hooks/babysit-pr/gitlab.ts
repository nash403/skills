import type { PrHead, PrReview, PrSnapshot, PrState, ReviewPoint } from '../../types'
import { newestPoint } from './pushes'
import { ciState, gitlabBlockedReason } from './rules'
import type { JobOutcome } from './rules'

export const GITLAB_MR_QUERY = `query($project: ID!, $iid: String!) {
  currentUser { username }
  project(fullPath: $project) {
    mergeRequest(iid: $iid) {
      title webUrl state draft
      author { username }
      diffHeadSha sourceBranch targetBranch
      detailedMergeStatus
      approved
      approvedBy { nodes { username } }
      reviewers { nodes { username mergeRequestInteraction { reviewState } } }
      diffStatsSummary { additions deletions fileCount }
      commitCount
      commits(first: 100) { nodes { sha committedDate message author { username } authorName } }
      headPipeline {
        status
        jobs(first: 100, retried: false) { nodes { status allowFailure } }
      }
      discussions(first: 100) {
        pageInfo { hasNextPage }
        nodes {
          id resolvable resolved
          notes(first: 100) { nodes { author { username } createdAt body url system position { filePath newLine } } }
        }
      }
    }
  }
}`

type Username = { username: string } | null

type Pipeline = { status: string; jobs: { nodes: { status: string; allowFailure: boolean }[] } }

type GitlabMr = {
  title: string
  webUrl: string
  state: 'opened' | 'closed' | 'merged' | 'locked'
  draft: boolean
  author: Username
  diffHeadSha: string
  sourceBranch: string
  targetBranch: string
  detailedMergeStatus: string
  approved: boolean
  approvedBy: { nodes: { username: string }[] }
  reviewers: { nodes: { username: string; mergeRequestInteraction: { reviewState: string } | null }[] }
  diffStatsSummary: { additions: number; deletions: number; fileCount: number }
  commitCount: number | null
  commits: { nodes: { sha: string; committedDate: string; message: string; author: Username; authorName: string }[] }
  headPipeline: Pipeline | null
  discussions: {
    pageInfo: { hasNextPage: boolean }
    nodes: {
      id: string
      resolvable: boolean
      resolved: boolean
      notes: {
        nodes: {
          author: Username
          createdAt: string
          body: string
          url: string
          system: boolean
          position: { filePath: string; newLine: number | null } | null
        }[]
      }
    }[]
  }
}

type GitlabAnswer = {
  data?: { currentUser: { username: string }; project: { mergeRequest: GitlabMr | null } | null }
  errors?: { message: string }[]
}

type GitlabVersion = { head_commit_sha: string; created_at: string; patch_id_sha: string | null }

type GitlabNote = GitlabMr['discussions']['nodes'][number]['notes']['nodes'][number]

type GitlabApprovals = { approved_by?: { user: { username: string }; approved_at?: string }[] }

const STATES: Record<GitlabMr['state'], PrState> = { opened: 'open', locked: 'open', closed: 'closed', merged: 'merged' }

// GitLab keeps one state per reviewer, with no time. UNREVIEWED and REVIEW_STARTED are no review yet.
const REVIEW_STATES: Record<string, PrReview['state']> = {
  APPROVED: 'approved',
  REQUESTED_CHANGES: 'changes-requested',
  REVIEWED: 'commented',
  UNAPPROVED: 'dismissed',
}

function submittedReviews(mr: GitlabMr): PrReview[] {
  return mr.reviewers.nodes.flatMap(({ username, mergeRequestInteraction }) => {
    const state = REVIEW_STATES[mergeRequestInteraction?.reviewState ?? '']

    return state ? [{ author: username, state, submittedAt: null }] : []
  })
}

const JOB_OUTCOMES: Record<string, JobOutcome | null> = {
  SUCCESS: 'passed',
  FAILED: 'failed',
  CANCELED: 'failed',
  RUNNING: 'running',
  MANUAL: null,
  SKIPPED: null,
}

// A manual or skipped job, or a failed one allowed to fail, doesn't decide the CI state.
function jobOutcome(job: { status: string; allowFailure: boolean }): JobOutcome | null {
  if (job.allowFailure && job.status === 'FAILED') {
    return null
  }

  const outcome = JOB_OUTCOMES[job.status]

  return outcome === undefined ? 'waiting' : outcome
}

// With no job that counts (all manual, say), the pipeline's own status decides.
function pipelineCi(pipeline: Pipeline | null) {
  if (pipeline === null) {
    return ciState(null)
  }

  const jobs = pipeline.jobs.nodes.flatMap(job => jobOutcome(job) ?? [])

  if (jobs.length > 0) {
    return ciState(jobs)
  }

  return ciState([jobOutcome({ status: pipeline.status, allowFailure: false }) ?? 'passed'])
}

function usernameOf(user: Username) {
  return user?.username ?? 'ghost'
}

// A GitLab review leaves no time of its own: approvals and change requests only show as system notes.
const REVIEW_SYSTEM_NOTE = /^(approved this merge request|requested changes)/

// Any note of the viewer's, threads or not, plus the system notes of their approvals and change requests.
function lastViewerActivity(mr: GitlabMr, viewer: string): ReviewPoint | null {
  const isViewerReview = (note: GitlabNote) => usernameOf(note.author) === viewer && (!note.system || REVIEW_SYSTEM_NOTE.test(note.body))
  const notes = mr.discussions.nodes.flatMap(discussion => discussion.notes.nodes.filter(isViewerReview))

  return newestPoint(notes.map(note => ({ at: note.createdAt, headSha: null })))
}

export function parseGitlabMr(answer: unknown): PrSnapshot {
  const { data, errors } = answer as GitlabAnswer
  const mr = data?.project?.mergeRequest

  if (!data || !mr) {
    throw new Error(errors?.[0]?.message ?? 'GitLab returned no MR')
  }

  const author = usernameOf(mr.author)
  const approvers = mr.approvedBy.nodes.map(user => user.username)
  const state = STATES[mr.state]
  const reviewers = [...new Set([...mr.reviewers.nodes.map(user => user.username), ...approvers])]

  return {
    url: mr.webUrl,
    title: mr.title,
    state,
    isDraft: mr.draft,
    isApproved: mr.approved && approvers.length > 0,
    author,
    viewer: data.currentUser.username,
    headSha: mr.diffHeadSha,
    headBranch: mr.sourceBranch,
    baseBranch: mr.targetBranch,
    headMessage: mr.commits.nodes[0]?.message ?? '',
    additions: mr.diffStatsSummary.additions,
    deletions: mr.diffStatsSummary.deletions,
    changedFiles: mr.diffStatsSummary.fileCount,
    ci: pipelineCi(mr.headPipeline),
    blocked: state === 'open' ? gitlabBlockedReason(mr.detailedMergeStatus) : null,
    reviewers: reviewers.filter(name => name !== author),
    approvals: approvers.map(user => ({ user, approvedAt: null })),
    reviews: submittedReviews(mr),
    commits: mr.commits.nodes
      .map(commit => ({ sha: commit.sha, author: commit.author?.username ?? commit.authorName, committedAt: commit.committedDate }))
      .reverse(),
    threads: mr.discussions.nodes
      .filter(discussion => discussion.resolvable)
      .map(discussion => {
        const notes = discussion.notes.nodes.filter(note => !note.system)

        return {
          id: discussion.id,
          isResolved: discussion.resolved,
          path: notes[0]?.position?.filePath ?? null,
          line: notes[0]?.position?.newLine ?? null,
          comments: notes.map(note => ({ author: usernameOf(note.author), createdAt: note.createdAt, body: note.body, url: note.url, headSha: null })),
        }
      }),
    heads: [],
    lastViewerActivity: lastViewerActivity(mr, data.currentUser.username),
    hasMoreThreads: mr.discussions.pageInfo.hasNextPage,
    hasMoreCommits: (mr.commitCount ?? 0) > mr.commits.nodes.length,
  }
}

// Only GitLab's REST API says when each approval was given.
export function parseGitlabApprovalTimes(answer: unknown): Record<string, string> {
  const { approved_by = [] } = answer as GitlabApprovals

  return Object.fromEntries(approved_by.flatMap(({ user, approved_at }) => (approved_at ? [[user.username, approved_at]] : [])))
}

// One MR version per push, newest first in GitLab's answer.
export function parseGitlabVersions(answer: unknown): PrHead[] {
  if (!Array.isArray(answer)) {
    return []
  }

  return (answer as GitlabVersion[])
    .map(version => ({ sha: version.head_commit_sha, pushedAt: version.created_at, patchId: version.patch_id_sha }))
    .reverse()
}
