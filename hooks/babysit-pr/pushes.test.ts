import { expect, test } from 'claude-code/testing'

import type { PrHead, PrSnapshot, PrThread } from '../../types'
import { comparedHeadShas, headAt, headToReviewFrom, isCodeChangedFrom, isCodePushedSince, parsePatchId } from './pushes'

// Dee's PR, reviewed by Bob. The head c3 was committed on the 10th, then pushed later.
const PR: PrSnapshot = {
  url: 'https://github.com/acme/app/pull/7',
  title: 'Tidy the tools',
  description: '',
  state: 'open',
  isDraft: false,
  isApproved: false,
  author: 'dee',
  viewer: 'bob',
  headSha: 'c3',
  headBranch: 'chore/tidy',
  baseBranch: 'main',
  headMessage: 'Tidy',
  additions: 5,
  deletions: 9,
  changedFiles: 1,
  ci: 'ok',
  blocked: null,
  reviewers: ['bob'],
  approvals: [],
  reviews: [],
  commits: [{ sha: 'c3', author: 'dee', committedAt: '2026-11-10T09:00:00Z' }],
  threads: [],
  heads: [],
  lastViewerActivity: null,
  hasMoreThreads: false,
  hasMoreCommits: false,
}

function githubHead(sha: string, patchId: string | null): PrHead {
  return { sha, pushedAt: null, patchId }
}

// GitLab MR versions, oldest first: c1 opened it, c2 rebased it on the 11th, c3 changed the code on the 12th.
const VERSIONS: PrHead[] = [
  { sha: 'c1', pushedAt: '2026-11-10T09:00:00Z', patchId: 'p1' },
  { sha: 'c2', pushedAt: '2026-11-11T09:00:00Z', patchId: 'p1' },
  { sha: 'c3', pushedAt: '2026-11-12T09:00:00Z', patchId: 'p3' },
]

const AFTER_REBASE = '2026-11-11T12:00:00Z'
const BEFORE_REBASE = '2026-11-10T12:00:00Z'

test('on GitHub, a push that only rebased keeps the patch-id, so no code was pushed since the head a review saw', () => {
  const rebased = { ...PR, heads: [githubHead('c1', 'p1'), githubHead('c3', 'p1')] }

  expect(isCodePushedSince(rebased, { at: BEFORE_REBASE, headSha: 'c1' })).toBe(false)
  expect(isCodeChangedFrom(rebased, 'c1')).toBe(false)
})

test('on GitHub, a push that changed the diff shows as code pushed', () => {
  const changed = { ...PR, heads: [githubHead('c1', 'p1'), githubHead('c3', 'p3')] }

  expect(isCodePushedSince(changed, { at: BEFORE_REBASE, headSha: 'c1' })).toBe(true)
  expect(isCodePushedSince(changed, { at: AFTER_REBASE, headSha: 'c3' })).toBe(false)
})

test('on GitHub, a head whose patch-id is unknown counts as code pushed when its sha differs', () => {
  const unknown = { ...PR, heads: [githubHead('c3', 'p3')] }

  expect(isCodeChangedFrom(unknown, 'c1')).toBe(true)
  expect(isCodeChangedFrom(unknown, 'c3')).toBe(false)
  expect(isCodeChangedFrom({ ...PR, heads: [githubHead('c1', 'p1'), githubHead('c3', null)] }, 'c1')).toBe(true)
})

test('on GitLab, the head a note saw is the newest version pushed before it, and a rebase alone is no code push', () => {
  const mr = { ...PR, heads: VERSIONS }

  expect(headAt(mr, { at: AFTER_REBASE, headSha: null })?.sha).toBe('c2')
  expect(isCodePushedSince(mr, { at: AFTER_REBASE, headSha: null })).toBe(true)
  expect(isCodePushedSince({ ...mr, headSha: 'c2', heads: VERSIONS.slice(0, 2) }, { at: BEFORE_REBASE, headSha: null })).toBe(false)
  expect(isCodePushedSince(mr, { at: '2026-11-12T12:00:00Z', headSha: null })).toBe(false)
})

test('on GitLab, a version newer than the head the note saw only counts against the newest one', () => {
  // The middle version's patch-id differs for a moment, as GitLab does when the base moves.
  const blip: PrHead[] = [
    { sha: 'c1', pushedAt: '2026-11-10T09:00:00Z', patchId: 'p1' },
    { sha: 'c2', pushedAt: '2026-11-11T09:00:00Z', patchId: 'p9' },
    { sha: 'c3', pushedAt: '2026-11-11T09:01:00Z', patchId: 'p1' },
  ]

  expect(isCodePushedSince({ ...PR, heads: blip }, { at: BEFORE_REBASE, headSha: null })).toBe(false)
})

test('with no head known before the point, the head commit date decides, as before push detection', () => {
  expect(headAt(PR, { at: BEFORE_REBASE, headSha: null })).toBeNull()
  expect(isCodePushedSince(PR, { at: '2026-11-09T09:00:00Z', headSha: null })).toBe(true)
  expect(isCodePushedSince(PR, { at: BEFORE_REBASE, headSha: null })).toBe(false)
})

// Each comment is written at 09:00 on the given day of November 2026.
function thread(id: string, isResolved: boolean, ...comments: [author: string, headSha: string, day: number][]): PrThread {
  return {
    id,
    isResolved,
    resolvedBy: isResolved ? 'dee' : null,
    path: null,
    line: null,
    comments: comments.map(([author, headSha, day], index) => ({
      author,
      createdAt: `2026-11-${day}T09:00:00Z`,
      body: 'Why?',
      url: `u${id}${index}`,
      headSha,
    })),
  }
}

test("GitHub patch-ids are read for the head and the heads the rules compare it with, each once", () => {
  const pr: PrSnapshot = {
    ...PR,
    approvals: [{ user: 'bob', sha: 'a1', reviewId: 3, approvedAt: null }, { user: 'cid', sha: 'x1', reviewId: 4, approvedAt: null }],
    lastViewerActivity: { at: AFTER_REBASE, headSha: 'r1' },
    threads: [thread('open', false, ['bob', 'b1', 10], ['dee', 'd1', 11]), thread('done', true, ['bob', 'b0', 10], ['cid', 'n1', 12])],
  }

  expect(comparedHeadShas(pr).sort()).toEqual(['a1', 'b1', 'c3', 'n1', 'r1'])
})

test('a patch-id is the first word git patch-id prints, and an empty diff has none', () => {
  expect(parsePatchId('e605e242aa 0000000000000000000000000000000000000000\n')).toBe('e605e242aa')
  expect(parsePatchId('')).toBeNull()
})

test('Review changes starts from the head of my last review on a peer PR, only once code was pushed since', () => {
  const reviewedC1 = { ...PR, lastViewerActivity: { at: BEFORE_REBASE, headSha: 'c1' } }

  expect(headToReviewFrom({ ...reviewedC1, heads: [githubHead('c1', 'p1'), githubHead('c3', 'p3')] })).toBe('c1')
  expect(headToReviewFrom({ ...reviewedC1, heads: [githubHead('c1', 'p1'), githubHead('c3', 'p1')] })).toBeNull()
  expect(headToReviewFrom({ ...reviewedC1, viewer: 'dee', heads: [githubHead('c1', 'p1'), githubHead('c3', 'p3')] })).toBeNull()
  expect(headToReviewFrom({ ...PR, heads: VERSIONS })).toBeNull()
  expect(headToReviewFrom({ ...PR, heads: VERSIONS, lastViewerActivity: { at: AFTER_REBASE, headSha: null } })).toBe('c2')
  expect(headToReviewFrom({ ...PR, state: 'merged', heads: VERSIONS, lastViewerActivity: { at: AFTER_REBASE, headSha: null } })).toBeNull()
})
