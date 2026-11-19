import type { PrApproval, PrRef } from '../../types'
import { gitlabDiscussionId, gitlabMrPath } from './refs'

// A write call to GitHub or GitLab. Text someone wrote goes on stdin as JSON, never in argv.
export type WriteCommand = { argv: string[]; stdin?: string }

export type ProcessOutput = { exitCode: number; stdout: string; stderr: string }

const GITHUB_REPLY_MUTATION =
  'mutation($id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) { comment { url } } }'

const GITHUB_RESOLVE_MUTATION = 'mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }'

function gitlabDiscussionPath(ref: PrRef, threadId: string) {
  return `${gitlabMrPath(ref)}/discussions/${gitlabDiscussionId(threadId)}`
}

export function replyCommand(ref: PrRef, threadId: string, body: string): WriteCommand {
  if (ref.platform === 'github') {
    return {
      argv: ['gh', 'api', 'graphql', '--hostname', ref.host, '--input', '-'],
      stdin: JSON.stringify({ query: GITHUB_REPLY_MUTATION, variables: { id: threadId, body } }),
    }
  }

  return {
    argv: ['glab', 'api', '--hostname', ref.host, '-X', 'POST', `${gitlabDiscussionPath(ref, threadId)}/notes`, '--input', '-'],
    stdin: JSON.stringify({ body }),
  }
}

export function resolveCommand(ref: PrRef, threadId: string): WriteCommand {
  if (ref.platform === 'github') {
    return { argv: ['gh', 'api', 'graphql', '--hostname', ref.host, '-f', `query=${GITHUB_RESOLVE_MUTATION}`, '-f', `id=${threadId}`] }
  }

  return { argv: ['glab', 'api', '--hostname', ref.host, '-X', 'PUT', gitlabDiscussionPath(ref, threadId), '-F', 'resolved=true'] }
}

function githubPullPath(ref: PrRef) {
  return `repos/${ref.project}/pulls/${ref.number}`
}

export function approveCommand(ref: PrRef, headSha: string): WriteCommand {
  if (ref.platform === 'github') {
    return { argv: ['gh', 'api', '--hostname', ref.host, '-X', 'POST', `${githubPullPath(ref)}/reviews`, '-f', 'event=APPROVE', '-f', `commit_id=${headSha}`] }
  }

  return { argv: ['glab', 'api', '--hostname', ref.host, '-X', 'POST', `${gitlabMrPath(ref)}/approve`, '-f', `sha=${headSha}`] }
}

// GitHub has no unapprove: the user's approving review is dismissed, which needs write access to the repo.
export function unapproveCommand(ref: PrRef, approval: PrApproval): WriteCommand {
  if ('reviewId' in approval) {
    return {
      argv: [
        'gh', 'api', '--hostname', ref.host, '-X', 'PUT', `${githubPullPath(ref)}/reviews/${approval.reviewId}/dismissals`,
        '-f', 'message=Approval withdrawn.', '-f', 'event=DISMISS',
      ],
    }
  }

  return { argv: ['glab', 'api', '--hostname', ref.host, '-X', 'POST', `${gitlabMrPath(ref)}/unapprove`] }
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text)

    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    // Not JSON: the caller falls back on stderr.
    return null
  }
}

function graphqlErrors(answer: Record<string, unknown> | null) {
  const errors = Array.isArray(answer?.errors) ? (answer.errors as unknown[]) : []

  return errors.map(error => (error as { message?: unknown } | null)?.message).filter((message): message is string => typeof message === 'string')
}

function restMessage(answer: Record<string, unknown> | null) {
  const message = answer?.message ?? answer?.error

  if (message === undefined || message === null) {
    return null
  }

  return typeof message === 'string' ? message : JSON.stringify(message)
}

// Null when the write went through. GraphQL answers errors with exit 0 at times, so they count either way.
export function writeFailureReason({ exitCode, stdout, stderr }: ProcessOutput): string | null {
  const answer = parseJson(stdout)
  const errors = graphqlErrors(answer)

  if (errors.length > 0) {
    return errors.join('; ')
  }

  if (exitCode === 0) {
    return null
  }

  return restMessage(answer) ?? (stderr.trim() || `exited with ${exitCode}`)
}
