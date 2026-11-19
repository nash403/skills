import { expect, test } from 'claude-code/testing'

import { parseReplyDraftInput, withDraft, withoutDraft, withoutThreadDraft } from './drafts'

const INPUT = { pr: 'https://github.com/acme/app/pull/12', threadId: 'PRRT_1', body: '  Fixed in c3, thanks.\n' }

function errorsOf(input: unknown) {
  const parsed = parseReplyDraftInput(input)

  return 'errors' in parsed ? parsed.errors : []
}

test('a draft names the PR by its URL, the thread by its platform id, and keeps the text trimmed', () => {
  expect(parseReplyDraftInput(INPUT)).toEqual({ prUrl: 'https://github.com/acme/app/pull/12', threadId: 'PRRT_1', body: 'Fixed in c3, thanks.' })
})

test('a draft missing a field, or too long, is refused with every error at once', () => {
  expect(errorsOf(undefined)).toEqual([
    '`pr` must be the PR or MR URL.',
    '`threadId` must be the platform id of the thread.',
    '`body` must be the text of the reply, at most 5000 characters.',
  ])
  expect(errorsOf({ ...INPUT, body: 'x'.repeat(5001) })).toEqual(['`body` must be the text of the reply, at most 5000 characters.'])
  expect(errorsOf({ ...INPUT, body: ' \n ' })).toEqual(['`body` must be the text of the reply, at most 5000 characters.'])
})

test('a new draft for a thread replaces the one it had', () => {
  const drafts = withDraft({ PRRT_2: 'Other' }, 'PRRT_1', 'First')

  expect(drafts).toEqual({ PRRT_2: 'Other', PRRT_1: 'First' })
  expect(withDraft(drafts, 'PRRT_1', 'Second')).toEqual({ PRRT_2: 'Other', PRRT_1: 'Second' })
})

test('clearing a draft leaves a newer one the model wrote meanwhile', () => {
  const drafts = { PRRT_1: 'Second', PRRT_2: 'Other' }

  expect(withoutDraft(drafts, 'PRRT_1', 'Second')).toEqual({ PRRT_2: 'Other' })
  expect(withoutDraft(drafts, 'PRRT_1', 'First')).toEqual(drafts)
})

test('a resolved thread loses its draft, whatever it says', () => {
  expect(withoutThreadDraft({ PRRT_1: 'Second', PRRT_2: 'Other' }, 'PRRT_1')).toEqual({ PRRT_2: 'Other' })
})
