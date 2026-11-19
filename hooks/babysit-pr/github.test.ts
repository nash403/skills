import { expect, test } from 'claude-code/testing'

import { parseGithubPr } from './github'

const ANSWER = {
  data: {
    viewer: { login: 'bob' },
    repository: {
      pullRequest: {
        number: 12,
        title: 'Add the export [skip ci]',
        url: 'https://github.com/acme/app/pull/12',
        state: 'OPEN',
        isDraft: false,
        author: { login: 'ana' },
        headRefName: 'feat/export',
        headRefOid: 'c2',
        baseRefName: 'main',
        additions: 40,
        deletions: 3,
        changedFiles: 2,
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'BLOCKED',
        reviewDecision: 'REVIEW_REQUIRED',
        reviewRequests: { nodes: [{ requestedReviewer: null }, { requestedReviewer: { login: 'cid' } }, { requestedReviewer: { slug: 'core' } }] },
        latestOpinionatedReviews: {
          nodes: [
            { databaseId: 2, author: { login: 'bob' }, state: 'APPROVED', submittedAt: '2026-11-11T09:00:00Z', commit: { oid: 'c1' } },
            { databaseId: 3, author: { login: 'dee' }, state: 'CHANGES_REQUESTED', submittedAt: '2026-11-11T09:30:00Z', commit: { oid: 'c1' } },
          ],
        },
        reviews: {
          nodes: [
            { databaseId: 1, author: { login: 'bob' }, state: 'COMMENTED', submittedAt: '2026-11-10T09:00:00Z', commit: { oid: 'c1' } },
            { databaseId: 4, author: { login: 'ana' }, state: 'COMMENTED', submittedAt: '2026-11-11T12:00:00Z', commit: { oid: 'c1' } },
            { databaseId: 5, author: { login: 'dee' }, state: 'DISMISSED', submittedAt: '2026-11-11T13:00:00Z', commit: { oid: 'c1' } },
            { databaseId: 6, author: { login: 'bob' }, state: 'PENDING', submittedAt: null, commit: { oid: 'c2' } },
          ],
        },
        participants: { nodes: [{ login: 'ana' }, { login: 'bob' }] },
        commits: {
          totalCount: 2,
          nodes: [
            { commit: { oid: 'c1', committedDate: '2026-11-10T08:00:00Z', messageHeadline: 'Add the export', authors: { nodes: [{ user: { login: 'ana' }, name: 'Ana', email: 'ana@x' }] } } },
            { commit: { oid: 'c2', committedDate: '2026-11-12T08:00:00Z', messageHeadline: 'Fix', authors: { nodes: [{ user: null, name: 'Bot', email: 'bot@x' }] } } },
          ],
        },
        statusCheckRollup: {
          nodes: [
            {
              commit: {
                oid: 'c2',
                message: 'Fix\n\nlonger body',
                statusCheckRollup: {
                  state: 'PENDING',
                  contexts: {
                    nodes: [
                      { __typename: 'CheckRun', name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'u' },
                      { __typename: 'CheckRun', name: 'old', status: 'COMPLETED', conclusion: 'STALE', detailsUrl: 'u' },
                      { __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null, detailsUrl: 'u' },
                      { __typename: 'StatusContext', context: 'deploy', state: 'PENDING', targetUrl: 'u' },
                    ],
                  },
                },
              },
            },
          ],
        },
        reviewThreads: {
          totalCount: 101,
          nodes: [
            {
              id: 'PRRT_1',
              isResolved: false,
              isOutdated: false,
              path: 'src/export.ts',
              line: 4,
              comments: {
                nodes: [
                  { id: 'PRRC_1', databaseId: 11, author: { login: 'bob' }, createdAt: '2026-11-10T09:00:00Z', body: 'Why?', url: 'https://github.com/acme/app/pull/12#discussion_r11', pullRequestReview: { commit: { oid: 'c1' } } },
                  { id: 'PRRC_2', databaseId: 12, author: null, createdAt: '2026-11-11T12:00:00Z', body: 'Because.', url: 'https://github.com/acme/app/pull/12#discussion_r12', pullRequestReview: null },
                ],
              },
            },
            { id: 'PRRT_2', isResolved: true, resolvedBy: { login: 'ana' }, isOutdated: true, path: 'README.md', line: null, comments: { nodes: [] } },
          ],
        },
      },
    },
  },
}

test('a GitHub answer reads as a PR snapshot', () => {
  const pr = parseGithubPr(ANSWER)

  expect(pr).toEqual({
    url: 'https://github.com/acme/app/pull/12',
    title: 'Add the export [skip ci]',
    state: 'open',
    isDraft: false,
    isApproved: false,
    author: 'ana',
    viewer: 'bob',
    headSha: 'c2',
    headBranch: 'feat/export',
    baseBranch: 'main',
    headMessage: 'Fix\n\nlonger body',
    additions: 40,
    deletions: 3,
    changedFiles: 2,
    ci: 'pending',
    blocked: 'approvals',
    reviewers: ['cid', 'bob', 'dee'],
    approvals: [{ user: 'bob', reviewId: 2, sha: 'c1', approvedAt: '2026-11-11T09:00:00Z' }],
    reviews: [
      { author: 'bob', state: 'commented', submittedAt: '2026-11-10T09:00:00Z' },
      { author: 'ana', state: 'commented', submittedAt: '2026-11-11T12:00:00Z' },
      { author: 'dee', state: 'dismissed', submittedAt: '2026-11-11T13:00:00Z' },
    ],
    commits: [
      { sha: 'c1', author: 'ana', committedAt: '2026-11-10T08:00:00Z' },
      { sha: 'c2', author: 'Bot', committedAt: '2026-11-12T08:00:00Z' },
    ],
    threads: [
      {
        id: 'PRRT_1',
        isResolved: false,
        resolvedBy: null,
        path: 'src/export.ts',
        line: 4,
        comments: [
          { author: 'bob', createdAt: '2026-11-10T09:00:00Z', body: 'Why?', url: 'https://github.com/acme/app/pull/12#discussion_r11', headSha: 'c1' },
          { author: 'ghost', createdAt: '2026-11-11T12:00:00Z', body: 'Because.', url: 'https://github.com/acme/app/pull/12#discussion_r12', headSha: null },
        ],
      },
      { id: 'PRRT_2', isResolved: true, resolvedBy: 'ana', path: 'README.md', line: null, comments: [] },
    ],
    heads: [],
    lastViewerActivity: { at: '2026-11-11T09:00:00Z', headSha: 'c1' },
    hasMoreThreads: true,
    hasMoreCommits: false,
  })
})

test('a merged GitHub PR with no checks reads no CI and no block', () => {
  const answer = structuredClone(ANSWER)
  const pr = answer.data.repository.pullRequest
  Object.assign(pr, { state: 'MERGED', mergeStateStatus: 'UNKNOWN', reviewDecision: 'APPROVED' })
  Object.assign(pr.statusCheckRollup.nodes[0]!.commit, { statusCheckRollup: null })

  expect(parseGithubPr(answer)).toMatchObject({ state: 'merged', ci: 'none', blocked: null, isApproved: true })
})

test('a GitHub PR with no review rule is approved once someone approves and nobody asks for changes', () => {
  const answer = structuredClone(ANSWER)
  const pr = answer.data.repository.pullRequest
  Object.assign(pr, { reviewDecision: null })
  pr.latestOpinionatedReviews.nodes.pop()

  expect(parseGithubPr(answer)).toMatchObject({ isApproved: true })
})

test('a GitHub answer without the PR is refused', () => {
  expect(() => parseGithubPr({ data: { viewer: { login: 'bob' }, repository: { pullRequest: null } } })).toThrow()
  expect(() => parseGithubPr({ errors: [{ message: 'Could not resolve to a Repository' }] })).toThrow()
})

test('a GitHub PR with more commits than the query reads says so', () => {
  const answer = structuredClone(ANSWER)
  answer.data.repository.pullRequest.commits.totalCount = 101

  expect(parseGithubPr(answer)).toMatchObject({ hasMoreCommits: true })
})

test("the viewer's last activity on GitHub is their newest review or comment, with the head it was on", () => {
  const answer = structuredClone(ANSWER)
  const pr = answer.data.repository.pullRequest
  pr.reviews.nodes.push({ databaseId: 7, author: { login: 'bob' }, state: 'COMMENTED', submittedAt: '2026-11-12T09:00:00Z', commit: { oid: 'c2' } })

  expect(parseGithubPr(answer).lastViewerActivity).toEqual({ at: '2026-11-12T09:00:00Z', headSha: 'c2' })
  expect(parseGithubPr({ ...answer, data: { ...answer.data, viewer: { login: 'eve' } } }).lastViewerActivity).toBeNull()
})

test('a GitHub approval whose commit is gone keeps its review id, to dismiss it, and its time', () => {
  const answer = structuredClone(ANSWER)
  Object.assign(answer.data.repository.pullRequest.latestOpinionatedReviews.nodes[0]!, { commit: null })

  expect(parseGithubPr(answer).approvals).toEqual([{ user: 'bob', reviewId: 2, sha: null, approvedAt: '2026-11-11T09:00:00Z' }])
})
