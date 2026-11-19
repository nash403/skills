import { expect, test } from 'claude-code/testing'

import { parseGitlabApprovalTimes, parseGitlabMr, parseGitlabVersions } from './gitlab'

const NOTE = { author: { username: 'bob' }, createdAt: '2026-11-10T09:00:00+01:00', system: false, position: null }

const ANSWER = {
  data: {
    currentUser: { username: 'bob' },
    project: {
      mergeRequest: {
        iid: '345',
        title: 'Add the export',
        webUrl: 'https://gitlab.com/team/app/-/merge_requests/345',
        state: 'opened',
        draft: true,
        author: { username: 'ana' },
        diffHeadSha: 'c2',
        sourceBranch: 'feat/export',
        targetBranch: 'develop',
        detailedMergeStatus: 'DISCUSSIONS_NOT_RESOLVED',
        approved: true,
        approvedBy: { nodes: [{ username: 'bob' }] },
        reviewers: {
          nodes: [
            { username: 'cid', mergeRequestInteraction: { reviewState: 'UNREVIEWED', approved: false } },
            { username: 'dee', mergeRequestInteraction: { reviewState: 'REQUESTED_CHANGES', approved: false } },
            { username: 'eve', mergeRequestInteraction: null },
          ],
        },
        diffStatsSummary: { additions: 1482, deletions: 82, fileCount: 24 },
        commitCount: 2,
        commits: {
          nodes: [
            { sha: 'c2', committedDate: '2026-11-12T10:00:00+01:00', message: 'Fix\n\n[ci skip]', author: null, authorName: 'Ana B' },
            { sha: 'c1', committedDate: '2026-11-10T08:00:00+01:00', message: 'Add the export', author: { username: 'ana' }, authorName: 'Ana B' },
          ],
        },
        headPipeline: {
          status: 'RUNNING',
          jobs: {
            nodes: [
              { name: 'lint', status: 'SUCCESS', allowFailure: false },
              { name: 'flaky', status: 'FAILED', allowFailure: true },
              { name: 'deploy', status: 'MANUAL', allowFailure: false },
              { name: 'test', status: 'RUNNING', allowFailure: false },
            ],
          },
        },
        discussions: {
          pageInfo: { hasNextPage: false },
          nodes: [
            {
              id: 'gid://gitlab/Discussion/a1',
              resolvable: true,
              resolved: false,
              notes: {
                nodes: [
                  { ...NOTE, body: 'Why?', url: 'https://gitlab.com/team/app/-/merge_requests/345#note_1', position: { filePath: 'src/export.ts', newLine: 4 } },
                  { ...NOTE, author: { username: 'ana' }, system: true, body: 'changed this line', url: 'u' },
                ],
              },
            },
            { id: 'gid://gitlab/Discussion/b2', resolvable: false, resolved: false, notes: { nodes: [{ ...NOTE, body: 'Nice', url: 'u' }] } },
            {
              id: 'gid://gitlab/Discussion/c3',
              resolvable: false,
              resolved: false,
              notes: { nodes: [{ ...NOTE, system: true, createdAt: '2026-11-11T10:00:00Z', body: 'approved this merge request', url: 'u' }] },
            },
            {
              id: 'gid://gitlab/Discussion/d4',
              resolvable: false,
              resolved: false,
              notes: { nodes: [{ ...NOTE, system: true, createdAt: '2026-11-12T10:00:00Z', body: 'requested review from @cid', url: 'u' }] },
            },
          ],
        },
      },
    },
  },
}

test('a GitLab answer reads as a PR snapshot', () => {
  expect(parseGitlabMr(ANSWER)).toEqual({
    url: 'https://gitlab.com/team/app/-/merge_requests/345',
    title: 'Add the export',
    state: 'open',
    isDraft: true,
    isApproved: true,
    author: 'ana',
    viewer: 'bob',
    headSha: 'c2',
    headBranch: 'feat/export',
    baseBranch: 'develop',
    headMessage: 'Fix\n\n[ci skip]',
    additions: 1482,
    deletions: 82,
    changedFiles: 24,
    ci: 'pending',
    blocked: 'threads',
    reviewers: ['cid', 'dee', 'eve', 'bob'],
    approvals: [{ user: 'bob', approvedAt: null }],
    reviews: [{ author: 'dee', state: 'changes-requested', submittedAt: null }],
    commits: [
      { sha: 'c1', author: 'ana', committedAt: '2026-11-10T08:00:00+01:00' },
      { sha: 'c2', author: 'Ana B', committedAt: '2026-11-12T10:00:00+01:00' },
    ],
    threads: [
      {
        id: 'gid://gitlab/Discussion/a1',
        isResolved: false,
        path: 'src/export.ts',
        line: 4,
        comments: [
          { author: 'bob', createdAt: '2026-11-10T09:00:00+01:00', body: 'Why?', url: 'https://gitlab.com/team/app/-/merge_requests/345#note_1', headSha: null },
        ],
      },
    ],
    heads: [],
    lastViewerActivity: { at: '2026-11-11T10:00:00Z', headSha: null },
    hasMoreThreads: false,
    hasMoreCommits: false,
  })
})

test('a GitLab MR approved by nobody is not approved, whatever the approval rules say', () => {
  const answer = structuredClone(ANSWER)
  const mr = answer.data.project.mergeRequest
  Object.assign(mr, { approved: true, approvedBy: { nodes: [] }, state: 'merged', headPipeline: null })

  expect(parseGitlabMr(answer)).toMatchObject({ isApproved: false, state: 'merged', ci: 'none', blocked: null })
})

test('a GitLab pipeline with no job that counts reads its own status', () => {
  const answer = structuredClone(ANSWER)
  const mr = answer.data.project.mergeRequest
  Object.assign(mr, { headPipeline: { status: 'CREATED', jobs: { nodes: [{ name: 'deploy', status: 'MANUAL', allowFailure: false }] } } })

  expect(parseGitlabMr(answer)).toMatchObject({ ci: 'starting' })
  Object.assign(mr.headPipeline, { status: 'SUCCESS' })
  expect(parseGitlabMr(answer)).toMatchObject({ ci: 'ok' })
})

test('GitLab approval times come from the approvals endpoint', () => {
  const answer = { approved_by: [{ user: { username: 'bob' }, approved_at: '2026-11-11T09:00:00.000Z' }, { user: { username: 'cid' } }] }

  expect(parseGitlabApprovalTimes(answer)).toEqual({ bob: '2026-11-11T09:00:00.000Z' })
})

test('a GitLab answer without the MR is refused', () => {
  expect(() => parseGitlabMr({ data: { currentUser: { username: 'bob' }, project: { mergeRequest: null } } })).toThrow()
})

test('a GitLab MR with more commits than the query reads says so', () => {
  const answer = structuredClone(ANSWER)
  answer.data.project.mergeRequest.commitCount = 101

  expect(parseGitlabMr(answer)).toMatchObject({ hasMoreCommits: true })
})

test("the viewer's last activity on GitLab is their newest note, an approval or a change request, any discussion", () => {
  const answer = structuredClone(ANSWER)
  answer.data.project.mergeRequest.discussions.nodes.push({
    id: 'gid://gitlab/Discussion/e5',
    resolvable: false,
    resolved: false,
    notes: { nodes: [{ ...NOTE, system: true, createdAt: '2026-11-13T10:00:00Z', body: 'requested changes', url: 'u' }] },
  })

  expect(parseGitlabMr(answer).lastViewerActivity).toEqual({ at: '2026-11-13T10:00:00Z', headSha: null })
  expect(parseGitlabMr({ data: { ...answer.data, currentUser: { username: 'eve' } } }).lastViewerActivity).toBeNull()
})

test('GitLab MR versions read as the pushed heads, oldest first, each with its patch-id', () => {
  const versions = [
    { id: 3, head_commit_sha: 'c3', created_at: '2026-11-12T09:00:00.000Z', patch_id_sha: 'p3', real_size: '24' },
    { id: 2, head_commit_sha: 'c2', created_at: '2026-11-11T09:00:00.000Z', patch_id_sha: 'p1', real_size: '24' },
    { id: 1, head_commit_sha: 'c1', created_at: '2026-11-10T09:00:00.000Z', patch_id_sha: null, real_size: '24' },
  ]

  expect(parseGitlabVersions(versions)).toEqual([
    { sha: 'c1', pushedAt: '2026-11-10T09:00:00.000Z', patchId: null },
    { sha: 'c2', pushedAt: '2026-11-11T09:00:00.000Z', patchId: 'p1' },
    { sha: 'c3', pushedAt: '2026-11-12T09:00:00.000Z', patchId: 'p3' },
  ])
  expect(parseGitlabVersions({ message: '404 Not found' })).toEqual([])
})
