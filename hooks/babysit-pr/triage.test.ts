import { expect, test } from 'claude-code/testing'

import type { PrSnapshot, PrThread, PrTriage, ThreadTriage } from '../../types'
import { feedbackTally, parseTriageInput, recordTriage, triageStatus } from './triage'
import type { TriageEntry } from './triage'

const ENTRY: TriageEntry = {
  threadId: 'PRRT_1',
  name: 'null-check-save',
  classification: 'Valid, change needed',
  importance: 'high',
  isHandled: false,
  summary: 'The save skips the null check on a new row.',
  details: 'A new row has no id yet, so `save` writes it with a null key. Check the id first.',
  lastCommentUrl: 'u2',
}

const INPUT = { pr: 'https://github.com/acme/app/pull/12', threads: [ENTRY] }

function thread(id: string, ...commentUrls: string[]): PrThread {
  return {
    id,
    isResolved: false,
    resolvedBy: null,
    path: 'src/save.ts',
    line: 3,
    comments: commentUrls.map(url => ({ author: 'bob', createdAt: '2026-11-10T09:00:00Z', body: 'Why?', url, headSha: null })),
  }
}

const PR: PrSnapshot = {
  url: 'https://github.com/acme/app/pull/12',
  title: 'Save rows',
  state: 'open',
  isDraft: false,
  isApproved: false,
  author: 'ana',
  viewer: 'ana',
  headSha: 'c1',
  headBranch: 'feat/save',
  baseBranch: 'main',
  headMessage: 'Save rows',
  additions: 1,
  deletions: 0,
  changedFiles: 1,
  ci: 'ok',
  blocked: null,
  reviewers: ['bob'],
  approvals: [],
  reviews: [],
  commits: [{ sha: 'c1', author: 'ana', committedAt: '2026-11-10T08:00:00Z' }],
  threads: [thread('PRRT_1', 'u1', 'u2'), thread('PRRT_2', 'u3')],
  heads: [],
  lastViewerActivity: null,
  hasMoreThreads: false,
  hasMoreCommits: false,
}

function triaged(name: string, lastCommentUrl: string, isHandled = false): ThreadTriage {
  return { name, classification: 'Question', importance: 'low', isHandled, summary: 'One line.', details: 'More.', lastCommentUrl }
}

function errorsOf(input: unknown) {
  const parsed = parseTriageInput(input)

  return 'errors' in parsed ? parsed.errors : []
}

test('a triage call names the PR by its URL and each thread by its platform id', () => {
  expect(parseTriageInput(INPUT)).toEqual({ prUrl: 'https://github.com/acme/app/pull/12', entries: [ENTRY] })
})

test('a triage call missing its PR or threads is refused', () => {
  expect(errorsOf(undefined)).toEqual(['`pr` must be the PR or MR URL.', '`threads` must list at least one thread.'])
  expect(errorsOf({ pr: 'x', threads: [] })).toEqual(['`threads` must list at least one thread.'])
})

test('every field of a thread is checked, and every error is said at once', () => {
  const entry = {
    threadId: '',
    name: 'Null Check',
    classification: 'Valid\nchange needed',
    importance: 'urgent',
    isHandled: 'no',
    summary: 'x'.repeat(201),
    details: ' ',
    lastCommentUrl: 'u2\nu3',
  }

  expect(errorsOf({ ...INPUT, threads: [entry] })).toEqual([
    '`threads[0].threadId` must be the platform id of the thread.',
    '`threads[0].name` must be a short kebab-case id, such as `null-check-save`.',
    '`threads[0].classification` must be one line of at most 60 characters.',
    '`threads[0].importance` must be high, medium or low.',
    '`threads[0].isHandled` must be true or false.',
    '`threads[0].summary` must be one line of at most 200 characters.',
    '`threads[0].details` must be a text of at most 2000 characters.',
    '`threads[0].lastCommentUrl` must be the URL of the newest comment you read in the thread.',
  ])
})

test('two entries for one thread, or one name for two threads, are refused', () => {
  const twice = { ...INPUT, threads: [ENTRY, { ...ENTRY, name: 'other-name' }] }
  const sameName = { ...INPUT, threads: [ENTRY, { ...ENTRY, threadId: 'PRRT_2' }] }

  expect(errorsOf(twice)).toEqual(['`threads[1]` triages PRRT_1 again.'])
  expect(errorsOf(sameName)).toEqual(['`threads[1].name` null-check-save is already the name of PRRT_1.'])
})

test('recording a triage keeps the newest comment the model read, and skips threads the PR does not have', () => {
  const recorded = recordTriage({}, PR, [ENTRY, { ...ENTRY, threadId: 'PRRT_9', name: 'gone' }])

  expect(recorded).toEqual({ triage: { PRRT_1: withoutThreadId(ENTRY) }, skipped: ['PRRT_9'] })
})

test('a triage that covers a comment newer than the pane has is up to date once the pane reads it', () => {
  const recorded = recordTriage({}, PR, [{ ...ENTRY, lastCommentUrl: 'u7' }])
  const triage = 'triage' in recorded ? recorded.triage : {}
  const [first] = PR.threads as [PrThread]

  expect(triageStatus(first, triage).kind).toBe('changed')
  expect(triageStatus({ ...first, comments: [...first.comments, { ...first.comments[0]!, url: 'u7' }] }, triage).kind).toBe('triaged')
})

test('a thread triaged again replaces its triage, and a name another thread holds is refused', () => {
  const before: PrTriage = { PRRT_1: triaged('old-name', 'u1'), PRRT_2: triaged('rename-helper', 'u3') }

  expect(recordTriage(before, PR, [ENTRY])).toMatchObject({ triage: { PRRT_1: { name: 'null-check-save', lastCommentUrl: 'u2' } } })
  expect(recordTriage(before, PR, [{ ...ENTRY, name: 'rename-helper' }])).toEqual({
    errors: ['The name rename-helper is already the name of PRRT_2 on this PR.'],
  })
})

test('a thread is not triaged, triaged, or changed when a comment came after its triage', () => {
  const triage: PrTriage = { PRRT_1: triaged('a', 'u1'), PRRT_2: triaged('b', 'u3') }
  const [first, second] = PR.threads as [PrThread, PrThread]

  expect(triageStatus(first, {})).toEqual({ kind: 'not-triaged' })
  expect(triageStatus(second, triage)).toEqual({ kind: 'triaged', triage: triaged('b', 'u3') })
  expect(triageStatus(first, triage)).toEqual({ kind: 'changed', triage: triaged('a', 'u1') })
})

test('the handled tally counts what is triaged and up to date, the rest is to triage', () => {
  const threads = [thread('t1', 'u1'), thread('t2', 'u2'), thread('t3', 'u3', 'u4'), thread('t4', 'u5')]
  const triage: PrTriage = { t1: triaged('a', 'u1', true), t2: triaged('b', 'u2', false), t3: triaged('c', 'u3', true) }

  expect(feedbackTally(threads, triage)).toEqual({ toTriage: [threads[2], threads[3]], handled: 1, total: 4 })
  expect(feedbackTally(threads.slice(0, 1), triage)).toEqual({ toTriage: [], handled: 1, total: 1 })
})

function withoutThreadId({ threadId: _, ...rest }: TriageEntry) {
  return rest
}
