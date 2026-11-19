import type { ReplyDrafts } from '../../types'
import { THREAD_ID_PROPERTY } from './triage'

const MAX_BODY_LENGTH = 5000

export const REPLY_DRAFT_TOOL_SPEC = {
  name: 'babysit_pr_draft_reply',
  description: [
    'Put a draft reply under an open review thread of a PR or MR the /babysit-pr pane follows.',
    'The user reads it there and posts or discards it with a click. Calling it again for the same thread replaces the draft.',
    'Draft it the way the addressing-feedback skill does: check the facts first, then write it short, straight to the point, in a human voice and in the language of the thread.',
    'This only writes to the pane: it posts nothing and resolves nothing.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      pr: { type: 'string', description: 'The URL of the PR or MR.' },
      threadId: THREAD_ID_PROPERTY,
      body: { type: 'string', maxLength: MAX_BODY_LENGTH, description: 'The text of the reply, in Markdown, as it will be posted.' },
    },
    required: ['pr', 'threadId', 'body'],
    additionalProperties: false,
  },
  isDeferred: false,
}

export const REPLY_DRAFT_TOOL = `mcp__nash403-skills__${REPLY_DRAFT_TOOL_SPEC.name}`

export type ReplyDraftInput = { prUrl: string; threadId: string; body: string }

function trimmedText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseReplyDraftInput(input: unknown): ReplyDraftInput | { errors: string[] } {
  const fields = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const prUrl = trimmedText(fields.pr)
  const threadId = trimmedText(fields.threadId)
  const body = trimmedText(fields.body)
  const errors: string[] = []

  if (prUrl === '') {
    errors.push('`pr` must be the PR or MR URL.')
  }

  if (threadId === '') {
    errors.push('`threadId` must be the platform id of the thread.')
  }

  if (body === '' || body.length > MAX_BODY_LENGTH) {
    errors.push(`\`body\` must be the text of the reply, at most ${MAX_BODY_LENGTH} characters.`)
  }

  return errors.length > 0 ? { errors } : { prUrl, threadId, body }
}

export function withDraft(drafts: ReplyDrafts, threadId: string, body: string): ReplyDrafts {
  return { ...drafts, [threadId]: body }
}

export function withoutThreadDraft(drafts: ReplyDrafts, threadId: string): ReplyDrafts {
  const { [threadId]: _, ...rest } = drafts

  return rest
}

// Clears the draft only while it is still `body`, the one the user saw: a newer one the model wrote since stays.
export function withoutDraft(drafts: ReplyDrafts, threadId: string, body: string): ReplyDrafts {
  return drafts[threadId] === body ? withoutThreadDraft(drafts, threadId) : drafts
}
