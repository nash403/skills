import { expect, test } from 'claude-code/testing'

import type { PrSnapshot, PrThread } from '../../types'
import { concerningThreads, excerpt, isMentioned, nextSteps } from './turns'

// Ana's PR, head committed on the 12th at 10:00. Bob and Cid review it.
const ANA_PR: PrSnapshot = {
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
  reviewers: ['bob', 'cid'],
  approvals: [],
  reviews: [],
  commits: [
    { sha: 'c1', author: 'ana', committedAt: '2026-11-10T10:00:00Z' },
    { sha: 'c2', author: 'ana', committedAt: '2026-11-12T10:00:00Z' },
  ],
  threads: [],
  hasMoreThreads: false,
  hasMoreCommits: false,
}

const AS_BOB: PrSnapshot = { ...ANA_PR, viewer: 'bob' }

type Message = [author: string, day: number, body?: string]

// Each message is posted at 09:00 on the given day of November 2026.
function thread(id: string, ...messages: Message[]): PrThread {
  return {
    id,
    isResolved: false,
    path: 'src/export.ts',
    line: 3,
    comments: messages.map(([author, day, body = 'Why?'], index) => ({
      author,
      createdAt: `2026-11-${String(day).padStart(2, '0')}T09:00:00Z`,
      body,
      url: `https://github.com/acme/app/pull/12#discussion_r${id}${index}`,
    })),
  }
}

function resolved(open: PrThread): PrThread {
  return { ...open, isResolved: true }
}

function turns(pr: PrSnapshot) {
  return concerningThreads(pr).map(({ thread, turn }) => [thread.id, turn])
}

function steps(pr: PrSnapshot) {
  return nextSteps(pr).map(({ actor, action }) => `${actor}: ${action}`)
}

test('a mention names the login as a word, whatever its case', () => {
  expect(isMentioned('@bob can you look?', 'bob')).toBe(true)
  expect(isMentioned('Thanks @Bob.', 'bob')).toBe(true)
  expect(isMentioned('cc @h.nintunze.klarys', 'h.nintunze.klarys')).toBe(true)
  expect(isMentioned('@bobby can you look?', 'bob')).toBe(false)
  expect(isMentioned('@bob.smith can you look?', 'bob')).toBe(false)
  expect(isMentioned('mail bob@acme.com', 'acme')).toBe(false)
  expect(isMentioned('bob, can you look?', 'bob')).toBe(false)
})

test('on my PR every unresolved thread concerns me: mine to answer unless I wrote last', () => {
  const pr = {
    ...ANA_PR,
    threads: [
      thread('waiting', ['bob', 10], ['ana', 11]),
      thread('answer', ['bob', 10]),
      thread('again', ['cid', 10], ['ana', 11], ['cid', 13]),
      resolved(thread('done', ['bob', 10])),
      thread('empty'),
    ],
  }

  expect(turns(pr)).toEqual([
    ['answer', 'reply'],
    ['again', 'reply'],
    ['waiting', 'theirs'],
  ])
})

test("on a peer's PR the threads I opened, replied to or am mentioned in concern me", () => {
  const pr = {
    ...AS_BOB,
    threads: [
      thread('opened', ['bob', 13]),
      thread('replied', ['cid', 13], ['bob', 13]),
      thread('mentioned', ['cid', 13, 'What does @bob think?']),
      thread('other', ['cid', 13], ['ana', 13]),
      resolved(thread('done', ['bob', 13])),
    ],
  }

  expect(concerningThreads(pr).map(({ thread }) => thread.id)).toEqual(['mentioned', 'opened', 'replied'])
})

test("on a peer's PR it's my turn when the author replied, I'm mentioned again, or code was pushed since my last message", () => {
  const pr = {
    ...AS_BOB,
    threads: [
      thread('author-replied', ['bob', 13], ['ana', 14]),
      thread('someone-else-replied', ['bob', 13], ['cid', 14]),
      thread('mentioned-again', ['bob', 13], ['cid', 14, '@bob agreed?']),
      thread('only-mentioned', ['ana', 13, '@bob is this fine?']),
      thread('before-push', ['bob', 11]),
    ],
  }

  expect(turns(pr)).toEqual([
    ['author-replied', 'author-replied'],
    ['mentioned-again', 'mentioned'],
    ['only-mentioned', 'mentioned'],
    ['before-push', 'pushed'],
    ['someone-else-replied', 'theirs'],
  ])
})

test('a first message is cut to one short line', () => {
  expect(excerpt('Why  this?\n\nIt looks off.')).toBe('Why this? It looks off.')
  expect(excerpt('word '.repeat(30))).toBe(`${'word '.repeat(15).trim()}…`)
  expect(excerpt('word '.repeat(30)).length).toBeLessThanOrEqual(80)
})

test('on my PR the next step puts my turn first, then what waits on reviewers', () => {
  const pr = {
    ...ANA_PR,
    threads: [
      thread('a', ['bob', 10]),
      thread('b', ['bob', 10]),
      thread('c', ['cid', 10]),
      thread('d', ['bob', 10], ['ana', 11]),
      thread('e', ['cid', 10], ['ana', 11]),
    ],
  }

  expect(steps(pr)).toEqual(['You: reply to 3 threads', 'Reviewers: 2 threads wait for them'])
  expect(steps({ ...pr, threads: [thread('a', ['bob', 10])] })).toEqual(['You: reply to 1 thread'])
  expect(steps({ ...pr, threads: [thread('d', ['bob', 10], ['ana', 11])] })).toEqual(['Reviewers: 1 thread waits for them'])
})

test('on my PR with no open thread the reviewers have to review or approve', () => {
  expect(steps(ANA_PR)).toEqual(['Reviewers: not reviewed yet'])
  expect(steps({ ...ANA_PR, threads: [resolved(thread('a', ['bob', 10]))] })).toEqual(['Reviewers: approve, no open thread'])
  expect(steps({ ...ANA_PR, approvals: [{ user: 'bob', sha: 'c1' }] })).toEqual(['Reviewers: approve, no open thread'])
  expect(steps({ ...ANA_PR, isApproved: true, approvals: [{ user: 'bob', sha: 'c2' }] })).toEqual([])
})

test("on a peer's PR the next step puts my turn first, then what waits on the author", () => {
  const pr = {
    ...AS_BOB,
    threads: [
      thread('a', ['bob', 13], ['ana', 14]),
      thread('b', ['bob', 13], ['ana', 14]),
      thread('c', ['cid', 13, '@bob?']),
      thread('d', ['bob', 11]),
      thread('e', ['bob', 13]),
      thread('f', ['bob', 13]),
      thread('g', ['bob', 13], ['cid', 14]),
    ],
  }

  expect(steps(pr)).toEqual([
    'You: the author replied on 2 of your threads',
    'You: mentioned in 1 thread',
    'You: code pushed since your review',
    'Author: 3 of your threads unanswered',
  ])
  expect(steps({ ...pr, threads: [thread('e', ['bob', 13])] })).toEqual(['Author: 1 of your threads unanswered'])
})

test("on a peer's PR I approve once my threads are resolved, and review again after a push", () => {
  const myResolvedThread = resolved(thread('a', ['bob', 13]))

  expect(steps(AS_BOB)).toEqual(['You: not reviewed yet'])
  expect(steps({ ...AS_BOB, threads: [myResolvedThread, thread('x', ['cid', 13])] })).toEqual([
    'You: ready to approve, all your threads resolved',
  ])
  expect(steps({ ...AS_BOB, threads: [myResolvedThread], approvals: [{ user: 'bob', sha: 'c2' }] })).toEqual([])
  expect(steps({ ...AS_BOB, approvals: [{ user: 'bob', sha: 'c1' }] })).toEqual(['You: code pushed since your review'])
})

test('a merged or closed PR has no next step', () => {
  const pr = { ...ANA_PR, threads: [thread('a', ['bob', 10])] }

  expect(steps({ ...pr, state: 'merged' })).toEqual([])
  expect(steps({ ...pr, state: 'closed' })).toEqual([])
})

test('on my PR a review without a thread counts as a review, a review by the author does not', () => {
  const changesRequested = { author: 'bob', state: 'changes-requested', submittedAt: '2026-11-11T09:00:00Z' } as const
  const authorReply = { author: 'ana', state: 'commented', submittedAt: '2026-11-11T09:00:00Z' } as const

  expect(steps({ ...ANA_PR, reviews: [changesRequested] })).toEqual(['Reviewers: approve, no open thread'])
  expect(steps({ ...ANA_PR, reviews: [authorReply] })).toEqual(['Reviewers: not reviewed yet'])
})

test("on a peer's PR my review without a thread waits on the author, then on me once code is pushed", () => {
  const review = (state: 'changes-requested' | 'commented', day: number) => ({
    author: 'bob',
    state,
    submittedAt: `2026-11-${day}T09:00:00Z`,
  })

  expect(steps({ ...AS_BOB, reviews: [review('changes-requested', 13)] })).toEqual(['Author: address your review'])
  expect(steps({ ...AS_BOB, reviews: [review('commented', 13)] })).toEqual(['You: ready to approve'])
  expect(steps({ ...AS_BOB, reviews: [review('changes-requested', 11)] })).toEqual(['You: code pushed since your review'])
  expect(steps({ ...AS_BOB, reviews: [{ ...review('commented', 13), author: 'cid' }] })).toEqual(['You: not reviewed yet'])
})
