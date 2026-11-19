import type { PrSnapshot, PrState } from '../../types'
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
      latestOpinionatedReviews(first: 20) { nodes { author { login } state submittedAt commit { oid } } }
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
          id isResolved path line
          comments(first: 100) { nodes { author { login } createdAt body url } }
        }
      }
    }
  }
}`

type Login = { login: string } | null

type Review = { author: Login; state: string; submittedAt: string | null; commit: { oid: string } | null }

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
      path: string | null
      line: number | null
      comments: { nodes: { author: Login; createdAt: string; body: string; url: string }[] }
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
    path: thread.path,
    line: thread.line,
    comments: thread.comments.nodes.map(comment => ({
      author: loginOf(comment.author),
      createdAt: comment.createdAt,
      body: comment.body,
      url: comment.url,
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

        return review.commit ? { user, sha: review.commit.oid } : { user, approvedAt: review.submittedAt }
      }),
    commits: pr.commits.nodes.map(({ commit }) => {
      const firstAuthor = commit.authors.nodes[0]

      return {
        sha: commit.oid,
        author: firstAuthor?.user?.login ?? firstAuthor?.name ?? 'unknown',
        committedAt: commit.committedDate,
      }
    }),
    threads,
    hasMoreThreads: pr.reviewThreads.totalCount > threads.length,
    hasMoreCommits: pr.commits.totalCount > pr.commits.nodes.length,
  }
}
