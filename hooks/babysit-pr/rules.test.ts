import { expect, test } from 'claude-code/testing'

import type { PrSnapshot, PrThread } from '../../types'
import {
  ciState,
  githubBlockedReason,
  gitlabBlockedReason,
  isPushedSinceApproval,
  isSkipCi,
  participants,
  statusChip,
  threadCounts,
} from './rules'

const OPEN_PR: PrSnapshot = {
  url: 'https://github.com/acme/app/pull/12',
  title: 'Add the export',
  state: 'open',
  isDraft: false,
  isApproved: false,
  author: 'ana',
  viewer: 'ana',
  headSha: 'c2',
  headBranch: 'feat/export',
  baseBranch: 'main',
  headMessage: 'Add the export',
  additions: 40,
  deletions: 3,
  changedFiles: 2,
  ci: 'ok',
  blocked: null,
  reviewers: ['bob'],
  approvals: [],
  commits: [
    { sha: 'c1', author: 'ana', committedAt: '2026-11-10T10:00:00Z' },
    { sha: 'c2', author: 'ana', committedAt: '2026-11-12T10:00:00Z' },
  ],
  threads: [],
  hasMoreThreads: false,
}

function thread(id: string, isResolved: boolean, ...comments: [author: string, createdAt: string][]): PrThread {
  return {
    id,
    isResolved,
    path: 'src/export.ts',
    line: 3,
    comments: comments.map(([author, createdAt]) => ({ author, createdAt, body: 'Why?', url: `https://x/${id}` })),
  }
}

test('CI reads ok, starting, pending or error from its jobs', () => {
  expect(ciState(null)).toBe('none')
  expect(ciState(['passed', 'passed'])).toBe('ok')
  expect(ciState([])).toBe('ok')
  expect(ciState(['waiting', 'running'])).toBe('starting')
  expect(ciState(['passed', 'running', 'waiting'])).toBe('pending')
  expect(ciState(['passed', 'failed', 'running'])).toBe('error')
})

test('skip CI shows from the title or the head commit message', () => {
  expect(isSkipCi('Bump deps [skip ci]', 'Bump deps')).toBe(true)
  expect(isSkipCi('Bump deps', 'Bump deps\n\n[CI SKIP]')).toBe(true)
  expect(isSkipCi('Skip CI when docs change', 'Skip CI when docs change')).toBe(false)
})

test('GitHub says why a PR is blocked, first match wins', () => {
  const blocked = { mergeStateStatus: 'BLOCKED', reviewDecision: 'APPROVED', ci: 'ok', openThreads: 0 } as const

  expect(githubBlockedReason({ ...blocked, mergeStateStatus: 'DIRTY' })).toBe('conflicts')
  expect(githubBlockedReason({ ...blocked, reviewDecision: 'REVIEW_REQUIRED', ci: 'error' })).toBe('approvals')
  expect(githubBlockedReason({ ...blocked, reviewDecision: 'CHANGES_REQUESTED' })).toBe('approvals')
  expect(githubBlockedReason({ ...blocked, ci: 'pending', openThreads: 2 })).toBe('checks')
  expect(githubBlockedReason({ ...blocked, ci: 'none' })).toBe('checks')
  expect(githubBlockedReason({ ...blocked, openThreads: 2 })).toBe('threads')
  expect(githubBlockedReason(blocked)).toBe('blocked')
  expect(githubBlockedReason({ ...blocked, mergeStateStatus: 'BEHIND' })).toBe('blocked')
  expect(githubBlockedReason({ ...blocked, mergeStateStatus: 'CLEAN' })).toBeNull()
  expect(githubBlockedReason({ ...blocked, mergeStateStatus: 'UNKNOWN' })).toBeNull()
  expect(githubBlockedReason({ ...blocked, mergeStateStatus: 'UNSTABLE' })).toBeNull()
})

test('GitLab says why an MR is blocked in one word', () => {
  expect(gitlabBlockedReason('CONFLICT')).toBe('conflicts')
  expect(gitlabBlockedReason('NEED_REBASE')).toBe('conflicts')
  expect(gitlabBlockedReason('NOT_APPROVED')).toBe('approvals')
  expect(gitlabBlockedReason('REQUESTED_CHANGES')).toBe('approvals')
  expect(gitlabBlockedReason('DISCUSSIONS_NOT_RESOLVED')).toBe('threads')
  expect(gitlabBlockedReason('CI_STILL_RUNNING')).toBe('checks')
  expect(gitlabBlockedReason('CI_MUST_PASS')).toBe('checks')
  expect(gitlabBlockedReason('BLOCKED_STATUS')).toBe('blocked')
  expect(gitlabBlockedReason('MERGEABLE')).toBeNull()
  expect(gitlabBlockedReason('DRAFT_STATUS')).toBeNull()
  expect(gitlabBlockedReason('CHECKING')).toBeNull()
})

test('the status chip takes the first state that matches', () => {
  const openThread = thread('t1', false, ['bob', '2026-11-13T10:00:00Z'])
  const closedThread = thread('t2', true, ['bob', '2026-11-13T10:00:00Z'])

  expect(statusChip({ ...OPEN_PR, state: 'merged', isApproved: true })).toBe('merged')
  expect(statusChip({ ...OPEN_PR, state: 'closed' })).toBe('closed')
  expect(statusChip({ ...OPEN_PR, isApproved: true })).toBe('approved')
  expect(statusChip({ ...OPEN_PR, isApproved: true, threads: [openThread] })).toBe('approved + threads')
  expect(statusChip({ ...OPEN_PR, threads: [thread('t3', false, ['bob', '2026-11-11T10:00:00Z'])] })).toBe('updated')
  expect(statusChip({ ...OPEN_PR, threads: [openThread, closedThread] })).toBe('reviewed')
  expect(statusChip({ ...OPEN_PR, threads: [closedThread] })).toBe('resolved')
  expect(statusChip(OPEN_PR)).toBe('opened')
})

test('a peer PR warns when code was pushed after my approval', () => {
  const peerPr = { ...OPEN_PR, viewer: 'bob' }

  expect(isPushedSinceApproval({ ...peerPr, approvals: [{ user: 'bob', sha: 'c1' }] })).toBe(true)
  expect(isPushedSinceApproval({ ...peerPr, approvals: [{ user: 'bob', sha: 'c2' }] })).toBe(false)
  expect(
    isPushedSinceApproval({ ...peerPr, approvals: [{ user: 'bob', approvedAt: '2026-11-11T10:00:00Z' }] }),
  ).toBe(true)
  expect(
    isPushedSinceApproval({ ...peerPr, approvals: [{ user: 'bob', approvedAt: '2026-11-12T12:00:00+01:00' }] }),
  ).toBe(false)
  expect(isPushedSinceApproval({ ...OPEN_PR, approvals: [{ user: 'ana', sha: 'c1' }] })).toBe(false)
  expect(isPushedSinceApproval({ ...peerPr, approvals: [{ user: 'cid', sha: 'c1' }] })).toBe(false)
})

test('threads count open over total', () => {
  const threads = [thread('t1', false, ['bob', 'x']), thread('t2', true, ['bob', 'x']), thread('t3', false, ['cid', 'x'])]

  expect(threadCounts({ ...OPEN_PR, threads })).toEqual({ open: 2, total: 3 })
})

test('participants list the author then the reviewers, with approvals and commits', () => {
  const pr: PrSnapshot = {
    ...OPEN_PR,
    reviewers: ['bob', 'ana'],
    approvals: [{ user: 'bob', sha: 'c2' }],
    commits: [...OPEN_PR.commits, { sha: 'c3', author: 'bob', committedAt: '2026-11-12T11:00:00Z' }],
    threads: [thread('t1', false, ['cid', 'x'], ['ana', 'y'])],
  }

  expect(participants(pr)).toEqual([
    { name: 'ana', role: 'author', hasApproved: false, hasCommits: true },
    { name: 'bob', role: 'reviewer', hasApproved: true, hasCommits: true },
    { name: 'cid', role: 'reviewer', hasApproved: false, hasCommits: false },
  ])
})
