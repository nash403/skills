import { expect, test } from 'claude-code/testing'

import type { PrRef } from '../../types'
import { approveCommand, replyCommand, resolveCommand, unapproveCommand, writeFailureReason } from './writes'

const GITHUB_REF: PrRef = { platform: 'github', host: 'github.com', project: 'acme/app', number: 12 }
const GITLAB_REF: PrRef = { platform: 'gitlab', host: 'gitlab.example.com', project: 'team/sub/tools', number: 21 }
const DISCUSSION = 'gid://gitlab/Discussion/a1b2'
const BODY = "Fixed in c3, thanks.\n\n`$(rm -rf ~)` and 'quotes' stay text; so does -f id=x."

test('a reply on GitHub goes through the thread reply mutation, its text on stdin only', () => {
  const { argv, stdin } = replyCommand(GITHUB_REF, 'PRRT_1', BODY)

  expect(argv).toEqual(['gh', 'api', 'graphql', '--hostname', 'github.com', '--input', '-'])
  expect(JSON.parse(stdin ?? '')).toEqual({
    query:
      'mutation($id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) { comment { url } } }',
    variables: { id: 'PRRT_1', body: BODY },
  })
})

test('a reply on GitLab is a note in the discussion, named by its hex id, its text on stdin only', () => {
  const { argv, stdin } = replyCommand(GITLAB_REF, DISCUSSION, BODY)

  expect(argv).toEqual([
    'glab', 'api', '--hostname', 'gitlab.example.com', '-X', 'POST',
    'projects/team%2Fsub%2Ftools/merge_requests/21/discussions/a1b2/notes', '--input', '-',
  ])
  expect(JSON.parse(stdin ?? '')).toEqual({ body: BODY })
})

test('resolving a thread on GitHub runs the resolve mutation on its id', () => {
  expect(resolveCommand(GITHUB_REF, 'PRRT_1')).toEqual({
    argv: [
      'gh', 'api', 'graphql', '--hostname', 'github.com',
      '-f', 'query=mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }',
      '-f', 'id=PRRT_1',
    ],
  })
})

test('resolving a discussion on GitLab sets it resolved through the REST API', () => {
  expect(resolveCommand(GITLAB_REF, DISCUSSION)).toEqual({
    argv: [
      'glab', 'api', '--hostname', 'gitlab.example.com', '-X', 'PUT',
      'projects/team%2Fsub%2Ftools/merge_requests/21/discussions/a1b2', '-F', 'resolved=true',
    ],
  })
})

test('approving on GitHub submits an approving review of the head the user saw', () => {
  expect(approveCommand(GITHUB_REF, 'c2')).toEqual({
    argv: ['gh', 'api', '--hostname', 'github.com', '-X', 'POST', 'repos/acme/app/pulls/12/reviews', '-f', 'event=APPROVE', '-f', 'commit_id=c2'],
  })
})

test('approving on GitLab approves the MR at the head the user saw', () => {
  expect(approveCommand(GITLAB_REF, 'c2')).toEqual({
    argv: ['glab', 'api', '--hostname', 'gitlab.example.com', '-X', 'POST', 'projects/team%2Fsub%2Ftools/merge_requests/21/approve', '-f', 'sha=c2'],
  })
})

test("unapproving on GitHub dismisses the user's own approving review", () => {
  expect(unapproveCommand(GITHUB_REF, { user: 'bob', sha: 'c1', reviewId: 2049, approvedAt: null })).toEqual({
    argv: [
      'gh', 'api', '--hostname', 'github.com', '-X', 'PUT', 'repos/acme/app/pulls/12/reviews/2049/dismissals',
      '-f', 'message=Approval withdrawn.', '-f', 'event=DISMISS',
    ],
  })
})

test('unapproving on GitLab revokes the approval', () => {
  expect(unapproveCommand(GITLAB_REF, { user: 'bob', approvedAt: null })).toEqual({
    argv: ['glab', 'api', '--hostname', 'gitlab.example.com', '-X', 'POST', 'projects/team%2Fsub%2Ftools/merge_requests/21/unapprove'],
  })
})

test('a write that went through has no failure reason', () => {
  const answer = JSON.stringify({ data: { addPullRequestReviewThreadReply: { comment: { url: 'u' } } } })

  expect(writeFailureReason({ exitCode: 0, stdout: answer, stderr: '' })).toBeNull()
  expect(writeFailureReason({ exitCode: 0, stdout: '{"id":"a1b2","notes":[]}', stderr: '' })).toBeNull()
})

test("a failed write gives the platform's reason: GraphQL errors, then a REST message, then stderr", () => {
  const graphql = JSON.stringify({ errors: [{ message: 'Resource not accessible by integration' }, { message: 'Second' }] })

  expect(writeFailureReason({ exitCode: 1, stdout: graphql, stderr: 'gh: Resource not accessible by integration' })).toBe(
    'Resource not accessible by integration; Second',
  )
  expect(writeFailureReason({ exitCode: 0, stdout: graphql, stderr: '' })).toBe('Resource not accessible by integration; Second')
  expect(writeFailureReason({ exitCode: 1, stdout: '{"message":"403 Forbidden"}', stderr: 'glab: 403 Forbidden (HTTP 403)' })).toBe('403 Forbidden')
  expect(writeFailureReason({ exitCode: 1, stdout: '{"message":{"body":["is too long"]}}', stderr: '' })).toBe('{"body":["is too long"]}')
  expect(writeFailureReason({ exitCode: 1, stdout: '', stderr: 'gh: HTTP 502\n' })).toBe('gh: HTTP 502')
  expect(writeFailureReason({ exitCode: 4, stdout: '', stderr: '' })).toBe('exited with 4')
})
