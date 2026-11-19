import type { PrReview, PrSnapshot, PrState, ReviewPoint } from '../../types'
import { newestPoint } from './pushes'
import { ciState, githubBlockedReason } from './rules'
import type { JobOutcome } from './rules'

// One read gives the whole PR. `statusCheckRollup` aliases the head commit, for its message and checks.
export const GITHUB_PR_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title url state isDraft
      author { login }
      headRefName headRefOid baseRefName
      additions deletions changedFiles
      mergeStateStatus reviewDecision
      reviewRequests(first: 20) { nodes { requestedReviewer { ... on User { login } ... on Bot { login } ... on Team { slug } } } }
      latestOpinionatedReviews(first: 20) { nodes { databaseId author { login } state submittedAt commit { oid } } }
      reviews(last: 50) { nodes { author { login } state submittedAt commit { oid } } }
      commits(last: 100) {
        totalCount
        nodes { commit { oid committedDate authors(first: 5) { nodes { user { login } name } } } }
      }
      statusCheckRollup: commits(last: 1) {
        nodes { commit { message statusCheckRollup {
          contexts(first: 100) { nodes {
            __typename
            ... on CheckRun { status conclusion }
            ... on StatusContext { state }
          } }
        } } }
      }
      reviewThreads(first: 100) {
        totalCount
        nodes {
          id isResolved resolvedBy { login } path line
          comments(first: 100) { nodes { author { login } createdAt body url pullRequestReview { commit { oid } } } }
        }
      }
    }
  }
}`

type Login = { login: string } | null

type Review = { databaseId: number; author: Login; state: string; submittedAt: string | null; commit: { oid: string } | null }

// The review a comment was submitted in: its commit is the head the comment was written on.
type CommentReview = { commit: { oid: string } | null } | null

type CheckContext =
  | { __typename: 'CheckRun'; status: string; conclusion: string | null }
  | { __typename: 'StatusContext'; state: string }

type GithubPr = {
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  author: Login
  headRefName: string
  headRefOid: string
  baseRefName: string
  additions: number
  deletions: number
  changedFiles: number
  mergeStateStatus: string
  reviewDecision: string | null
  reviewRequests: { nodes: { requestedReviewer: { login?: string } | null }[] }
  latestOpinionatedReviews: { nodes: Review[] }
  reviews: { nodes: Review[] }
  commits: {
    totalCount: number
    nodes: { commit: { oid: string; committedDate: string; authors: { nodes: { user: Login; name: string }[] } } }[]
  }
  statusCheckRollup: {
    nodes: { commit: { message: string; statusCheckRollup: { contexts: { nodes: CheckContext[] } } | null } }[]
  }
  reviewThreads: {
    totalCount: number
    nodes: {
      id: string
      isResolved: boolean
      resolvedBy?: Login
      path: string | null
      line: number | null
      comments: { nodes: { author: Login; createdAt: string; body: string; url: string; pullRequestReview?: CommentReview }[] }
    }[]
  }
}

type GithubAnswer = {
  data?: { viewer: { login: string }; repository: { pullRequest: GithubPr | null } | null }
  errors?: { message: string }[]
}

const PASSED_CONCLUSIONS = ['SUCCESS', 'NEUTRAL', 'SKIPPED']
const STATUS_OUTCOMES: Record<string, JobOutcome> = { SUCCESS: 'passed', PENDING: 'waiting', EXPECTED: 'waiting' }

// A stale check run was superseded and doesn't count.
function jobOutcome(context: CheckContext): JobOutcome | null {
  if (context.__typename === 'StatusContext') {
    return STATUS_OUTCOMES[context.state] ?? 'failed'
  }

  if (context.status !== 'COMPLETED') {
    return context.status === 'IN_PROGRESS' ? 'running' : 'waiting'
  }

  if (context.conclusion === 'STALE') {
    return null
  }

  return PASSED_CONCLUSIONS.includes(context.conclusion ?? '') ? 'passed' : 'failed'
}

function loginOf(user: Login) {
  return user?.login ?? 'ghost'
}

const STATES: Record<GithubPr['state'], PrState> = { OPEN: 'open', CLOSED: 'closed', MERGED: 'merged' }

// A PENDING review is the viewer's own draft, not submitted yet.
const REVIEW_STATES: Record<string, PrReview['state']> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  COMMENTED: 'commented',
  DISMISSED: 'dismissed',
}

function submittedReviews(pr: GithubPr): PrReview[] {
  return pr.reviews.nodes.flatMap(review => {
    const state = REVIEW_STATES[review.state]

    return state ? [{ author: loginOf(review.author), state, submittedAt: review.submittedAt }] : []
  })
}

function isApproved(pr: GithubPr) {
  if (pr.reviewDecision !== null) {
    return pr.reviewDecision === 'APPROVED'
  }

  const states = pr.latestOpinionatedReviews.nodes.map(review => review.state)

  return states.includes('APPROVED') && !states.includes('CHANGES_REQUESTED')
}

function reviewersOf(pr: GithubPr, author: string) {
  const requested = pr.reviewRequests.nodes.flatMap(({ requestedReviewer }) => requestedReviewer?.login ?? [])
  const reviewed = [...pr.latestOpinionatedReviews.nodes, ...pr.reviews.nodes].map(review => loginOf(review.author))

  return [...new Set([...requested, ...reviewed])].filter(name => name !== author)
}

// Every reply in a thread is a review too, so reviews and comments both count.
function lastViewerActivity(pr: GithubPr, viewer: string) {
  const reviews = [...pr.reviews.nodes, ...pr.latestOpinionatedReviews.nodes].flatMap(review =>
    loginOf(review.author) === viewer && review.state !== 'PENDING' && review.submittedAt
      ? [{ at: review.submittedAt, headSha: review.commit?.oid ?? null }]
      : [],
  )
  const comments = pr.reviewThreads.nodes.flatMap(thread =>
    thread.comments.nodes.flatMap(comment =>
      loginOf(comment.author) === viewer ? [{ at: comment.createdAt, headSha: comment.pullRequestReview?.commit?.oid ?? null }] : [],
    ),
  )

  return newestPoint([...reviews, ...comments])
}

export function parseGithubPr(answer: unknown): PrSnapshot {
  const { data, errors } = answer as GithubAnswer
  const pr = data?.repository?.pullRequest

  if (!data || !pr) {
    throw new Error(errors?.[0]?.message ?? 'GitHub returned no PR')
  }

  const head = pr.statusCheckRollup.nodes[0]?.commit
  const contexts = head?.statusCheckRollup?.contexts.nodes
  const ci = ciState(contexts ? contexts.flatMap(context => jobOutcome(context) ?? []) : null)
  const threads = pr.reviewThreads.nodes.map(thread => ({
    id: thread.id,
    isResolved: thread.isResolved,
    resolvedBy: thread.resolvedBy?.login ?? null,
    path: thread.path,
    line: thread.line,
    comments: thread.comments.nodes.map(comment => ({
      author: loginOf(comment.author),
      createdAt: comment.createdAt,
      body: comment.body,
      url: comment.url,
      headSha: comment.pullRequestReview?.commit?.oid ?? null,
    })),
  }))
  const author = loginOf(pr.author)
  const state = STATES[pr.state]
  const blocked = githubBlockedReason({
    mergeStateStatus: pr.mergeStateStatus,
    reviewDecision: pr.reviewDecision,
    ci,
    openThreads: threads.filter(thread => !thread.isResolved).length,
  })

  return {
    url: pr.url,
    title: pr.title,
    state,
    isDraft: pr.isDraft,
    isApproved: isApproved(pr),
    author,
    viewer: data.viewer.login,
    headSha: pr.headRefOid,
    headBranch: pr.headRefName,
    baseBranch: pr.baseRefName,
    headMessage: head?.message ?? '',
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    ci,
    blocked: state === 'open' ? blocked : null,
    reviewers: reviewersOf(pr, author),
    approvals: pr.latestOpinionatedReviews.nodes
      .filter(review => review.state === 'APPROVED')
      .map(review => {
        const user = loginOf(review.author)

        return { user, reviewId: review.databaseId, sha: review.commit?.oid ?? null, approvedAt: review.submittedAt }
      }),
    reviews: submittedReviews(pr),
    commits: pr.commits.nodes.map(({ commit }) => {
      const firstAuthor = commit.authors.nodes[0]

      return {
        sha: commit.oid,
        author: firstAuthor?.user?.login ?? firstAuthor?.name ?? 'unknown',
        committedAt: commit.committedDate,
      }
    }),
    threads,
    heads: [],
    lastViewerActivity: lastViewerActivity(pr, data.viewer.login),
    hasMoreThreads: pr.reviewThreads.totalCount > threads.length,
    hasMoreCommits: pr.commits.totalCount > pr.commits.nodes.length,
  }
}
