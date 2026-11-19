import { expect, test } from 'claude-code/testing'

import type { CodeHead, PrChange, PrSnapshot, PrThread } from '../../types'
import { changeText, changesToast, detectChanges, mergeChanges } from './changes'

// Dee's PR, reviewed by Bob, read at c1.
const PR: PrSnapshot = {
  url: 'https://github.com/acme/app/pull/7',
  title: 'Tidy the tools',
  description: '',
  state: 'open',
  isDraft: false,
  isApproved: false,
  author: 'dee',
  viewer: 'bob',
  headSha: 'c1',
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
  commits: [{ sha: 'c1', author: 'dee', committedAt: '2026-11-10T09:00:00Z' }],
  threads: [],
  heads: [{ sha: 'c1', pushedAt: null, patchId: 'p1' }],
  lastViewerActivity: null,
  hasMoreThreads: false,
  hasMoreCommits: false,
}

const READ_AT_C1: CodeHead = { sha: 'c1', patchId: 'p1', baseBranch: 'main' }

function pushed(pr: PrSnapshot, sha: string, patchId: string | null): PrSnapshot {
  return { ...pr, headSha: sha, heads: [{ sha, pushedAt: null, patchId }] }
}

type Message = [author: string, body?: string]

function thread(id: string, ...messages: Message[]): PrThread {
  return {
    id,
    isResolved: false,
    resolvedBy: null,
    path: 'src/tools.ts',
    line: 3,
    comments: messages.map(([author, body = 'Why?'], index) => ({
      author,
      createdAt: `2026-11-1${index}T09:00:00Z`,
      body,
      url: `${PR.url}#discussion_${id}_${index}`,
      headSha: null,
    })),
  }
}

function resolvedBy(user: string, open: PrThread): PrThread {
  return { ...open, isResolved: true, resolvedBy: user }
}

function withThreads(pr: PrSnapshot, ...threads: PrThread[]): PrSnapshot {
  return { ...pr, threads }
}

function approvedBy(pr: PrSnapshot, ...users: string[]): PrSnapshot {
  return { ...pr, approvals: users.map(user => ({ user, approvedAt: null })) }
}

test('the first read of a PR raises no event', () => {
  const read = detectChanges(null, approvedBy(withThreads(PR, thread('t1', ['bob'], ['dee'])), 'cid'), null)

  expect(read.changes).toEqual([])
  expect(read.codeHead).toEqual(READ_AT_C1)
})

test('a push that changes the code of a peer PR is an event, a push that only rebases it is not', () => {
  expect(detectChanges(PR, pushed(PR, 'c2', 'p2'), READ_AT_C1).changes).toEqual([{ kind: 'code-pushed' }])
  expect(detectChanges(PR, pushed(PR, 'c2', 'p1'), READ_AT_C1).changes).toEqual([])
})

test('a head whose patch-id could not be read raises no event, and the next read that has it compares with the last known head', () => {
  const failed = detectChanges(PR, pushed(PR, 'c2', null), READ_AT_C1)

  expect(failed.changes).toEqual([])
  expect(failed.codeHead).toEqual(READ_AT_C1)
  expect(detectChanges(pushed(PR, 'c2', null), pushed(PR, 'c2', 'p2'), failed.codeHead).changes).toEqual([{ kind: 'code-pushed' }])
})

test('a push on my own PR, or after the PR moved to another base, raises no event', () => {
  const mine = { ...PR, author: 'bob', viewer: 'bob' }

  expect(detectChanges(mine, pushed(mine, 'c2', 'p2'), READ_AT_C1).changes).toEqual([])
  expect(detectChanges(PR, { ...pushed(PR, 'c2', 'p2'), baseBranch: 'develop' }, READ_AT_C1).changes).toEqual([])
})

test('replies in my threads are grouped by who wrote them, my own replies are no event', () => {
  const before = withThreads(PR, thread('t1', ['bob']), thread('t2', ['bob']), thread('t3', ['bob']))
  const after = withThreads(PR, thread('t1', ['bob'], ['dee'], ['bob']), thread('t2', ['bob'], ['dee'], ['dee']), thread('t3', ['bob'], ['cid']))

  expect(detectChanges(before, after, READ_AT_C1).changes).toEqual([
    { kind: 'replied', author: 'dee', threadIds: ['t1', 't2'] },
    { kind: 'replied', author: 'cid', threadIds: ['t3'] },
  ])
})

test('on my PR a reviewer opening a thread counts as a reply to me', () => {
  const mine = { ...PR, author: 'bob', viewer: 'bob' }

  expect(detectChanges(mine, withThreads(mine, thread('t1', ['cid'])), READ_AT_C1).changes).toEqual([
    { kind: 'replied', author: 'cid', threadIds: ['t1'] },
  ])
})

test('a new message that mentions me is a mention, in a thread I never wrote in too; a thread that is not mine raises nothing', () => {
  const before = withThreads(PR, thread('t1', ['bob']), thread('t2', ['cid']))
  const after = withThreads(PR, thread('t1', ['bob'], ['dee', 'See @bob']), thread('t2', ['cid'], ['dee', 'Ping @Bob.']), thread('t3', ['cid']))

  expect(detectChanges(before, after, READ_AT_C1).changes).toEqual([{ kind: 'mentioned', author: 'dee', threadIds: ['t1', 't2'] }])
})

test('all my threads resolved by someone else is an event; resolved by me, or with one still open, it is not', () => {
  const open = withThreads(PR, thread('t1', ['bob']), thread('t2', ['bob']), thread('t3', ['cid']))

  expect(detectChanges(open, withThreads(PR, resolvedBy('dee', thread('t1', ['bob'])), resolvedBy('bob', thread('t2', ['bob'])), thread('t3', ['cid'])), READ_AT_C1).changes).toEqual([
    { kind: 'threads-resolved' },
  ])
  expect(detectChanges(open, withThreads(PR, resolvedBy('bob', thread('t1', ['bob'])), resolvedBy('bob', thread('t2', ['bob']))), READ_AT_C1).changes).toEqual([])
  expect(detectChanges(open, withThreads(PR, resolvedBy('dee', thread('t1', ['bob'])), thread('t2', ['bob'])), READ_AT_C1).changes).toEqual([])
})

test('an approval given or withdrawn by someone else is an event, mine is not', () => {
  const before = approvedBy(PR, 'cid')

  expect(detectChanges(before, approvedBy(PR, 'eve', 'bob'), READ_AT_C1).changes).toEqual([
    { kind: 'approved', user: 'eve' },
    { kind: 'unapproved', user: 'cid' },
  ])
})

test('changes from several reads add up: threads join, code pushed shows once, the newest approval news wins', () => {
  const older: PrChange[] = [{ kind: 'code-pushed' }, { kind: 'replied', author: 'dee', threadIds: ['t1'] }, { kind: 'approved', user: 'cid' }]
  const newer: PrChange[] = [{ kind: 'code-pushed' }, { kind: 'replied', author: 'dee', threadIds: ['t1', 't2'] }, { kind: 'unapproved', user: 'cid' }, { kind: 'threads-resolved' }]

  expect(mergeChanges(older, newer)).toEqual([
    { kind: 'code-pushed' },
    { kind: 'replied', author: 'dee', threadIds: ['t1', 't2'] },
    { kind: 'threads-resolved' },
    { kind: 'unapproved', user: 'cid' },
  ])
})

test('each change reads as one line, and one toast groups the changes of a read', () => {
  const changes: PrChange[] = [
    { kind: 'code-pushed' },
    { kind: 'replied', author: 'dee', threadIds: ['t1', 't2'] },
    { kind: 'mentioned', author: 'cid', threadIds: ['t3'] },
    { kind: 'threads-resolved' },
    { kind: 'approved', user: 'eve' },
    { kind: 'unapproved', user: 'cid' },
  ]

  expect(changes.map(changeText)).toEqual([
    'Code pushed since your review',
    '@dee replied on 2 threads',
    '@cid mentioned you in 1 thread',
    'All your threads are resolved',
    '@eve approved',
    '@cid withdrew their approval',
  ])
  expect(changesToast('acme/app#7', changes.slice(0, 2))).toBe('acme/app#7: Code pushed since your review · @dee replied on 2 threads')
})
