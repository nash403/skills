import type { PrSnapshot, PrThread, PrTriage, ThreadTriage, TriageImportance } from '../../types'

export type TriageEntry = Omit<ThreadTriage, 'lastCommentUrl'> & { threadId: string }

export type TriageStatus = { kind: 'not-triaged' } | { kind: 'triaged' | 'changed'; triage: ThreadTriage }

const IMPORTANCES: readonly TriageImportance[] = ['high', 'medium', 'low']
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 40
const MAX_CLASSIFICATION_LENGTH = 60
const MAX_SUMMARY_LENGTH = 200
const MAX_DETAILS_LENGTH = 2000

const THREAD_PROPERTIES = {
  threadId: { type: 'string', description: 'The platform id of the thread, as the pane gave it: PRRT_... on GitHub, gid://gitlab/Discussion/... on GitLab.' },
  name: { type: 'string', pattern: KEBAB_CASE.source, maxLength: MAX_NAME_LENGTH, description: 'A short kebab-case id, two or three words that sum the thread up, such as null-check-save.' },
  classification: { type: 'string', maxLength: MAX_CLASSIFICATION_LENGTH, description: 'Whether it holds up and what it calls for, in plain words: "Valid, change needed", "Wrong, missing context", "Already fixed", "Question", "Nitpick"...' },
  importance: { type: 'string', enum: IMPORTANCES },
  isHandled: { type: 'boolean', description: 'True when the point needs nothing more from anyone: fixed in the code, answered, or not worth acting on.' },
  summary: { type: 'string', maxLength: MAX_SUMMARY_LENGTH, description: 'One line: what the thread asks and where it stands.' },
  details: { type: 'string', maxLength: MAX_DETAILS_LENGTH, description: 'A few sentences: what you checked in the code and what it shows, and the fix when one is needed.' },
}

export const TRIAGE_TOOL_SPEC = {
  name: 'babysit_pr_triage',
  description: [
    'Record the triage of review threads on a PR or MR the /babysit-pr pane follows, so the pane shows it beside each thread.',
    'Triage first, the way the addressing-feedback skill does: read every message of each thread, check what it says against the code, then classify it.',
    "One entry per thread. Write the summaries in the conversation's language.",
    'This only writes to the pane: it posts nothing, resolves nothing and changes no code.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      pr: { type: 'string', description: 'The URL of the PR or MR.' },
      threads: {
        type: 'array',
        minItems: 1,
        items: { type: 'object', properties: THREAD_PROPERTIES, required: Object.keys(THREAD_PROPERTIES), additionalProperties: false },
      },
    },
    required: ['pr', 'threads'],
  },
  isDeferred: false,
}

// The name the model calls it by.
export const TRIAGE_TOOL = `mcp__nash403-skills__${TRIAGE_TOOL_SPEC.name}`

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isLine(value: unknown, maxLength: number): value is string {
  return isText(value) && !value.includes('\n') && value.length <= maxLength
}

function entryErrors(entry: Record<string, unknown>, at: string) {
  const errors: string[] = []

  if (!isText(entry.threadId)) {
    errors.push(`\`${at}.threadId\` must be the platform id of the thread.`)
  }

  if (!isLine(entry.name, MAX_NAME_LENGTH) || !KEBAB_CASE.test(entry.name)) {
    errors.push(`\`${at}.name\` must be a short kebab-case id, such as \`null-check-save\`.`)
  }

  if (!isLine(entry.classification, MAX_CLASSIFICATION_LENGTH)) {
    errors.push(`\`${at}.classification\` must be one line of at most ${MAX_CLASSIFICATION_LENGTH} characters.`)
  }

  if (!IMPORTANCES.includes(entry.importance as TriageImportance)) {
    errors.push(`\`${at}.importance\` must be high, medium or low.`)
  }

  if (typeof entry.isHandled !== 'boolean') {
    errors.push(`\`${at}.isHandled\` must be true or false.`)
  }

  if (!isLine(entry.summary, MAX_SUMMARY_LENGTH)) {
    errors.push(`\`${at}.summary\` must be one line of at most ${MAX_SUMMARY_LENGTH} characters.`)
  }

  if (!isText(entry.details) || entry.details.length > MAX_DETAILS_LENGTH) {
    errors.push(`\`${at}.details\` must be a text of at most ${MAX_DETAILS_LENGTH} characters.`)
  }

  return errors
}

function duplicateErrors(entries: readonly TriageEntry[]) {
  return entries.flatMap((entry, index) => {
    const earlier = entries.slice(0, index)
    const sameThread = earlier.find(other => other.threadId === entry.threadId)
    const sameName = earlier.find(other => other.name === entry.name)

    if (sameThread) {
      return [`\`threads[${index}]\` triages ${entry.threadId} again.`]
    }

    return sameName ? [`\`threads[${index}].name\` ${entry.name} is already the name of ${sameName.threadId}.`] : []
  })
}

function toEntry({ threadId, name, classification, importance, isHandled, summary, details }: Record<string, unknown>): TriageEntry {
  return { threadId, name, classification, importance, isHandled, summary, details } as TriageEntry
}

// The triage tool's arguments, checked field by field so the model can fix every mistake in one more call.
export function parseTriageInput(input: unknown): { prUrl: string; entries: TriageEntry[] } | { errors: string[] } {
  const { pr, threads } = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const prUrl = isText(pr) ? pr : null
  const errors: string[] = []

  if (prUrl === null) {
    errors.push('`pr` must be the PR or MR URL.')
  }

  if (!Array.isArray(threads) || threads.length === 0) {
    return { errors: [...errors, '`threads` must list at least one thread.'] }
  }

  const rawEntries = threads.map(entry => (typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}))
  errors.push(...rawEntries.flatMap((entry, index) => entryErrors(entry, `threads[${index}]`)))

  if (errors.length > 0 || prUrl === null) {
    return { errors }
  }

  const entries = rawEntries.map(toEntry)
  const duplicates = duplicateErrors(entries)

  return duplicates.length > 0 ? { errors: duplicates } : { prUrl, entries }
}

function lastCommentUrl(thread: PrThread) {
  return thread.comments.at(-1)?.url ?? ''
}

// A name stays the thread's for the session, so a name another thread holds is refused.
export function recordTriage(
  triage: PrTriage,
  pr: PrSnapshot,
  entries: readonly TriageEntry[],
): { triage: PrTriage; skipped: string[] } | { errors: string[] } {
  const threads = new Map(pr.threads.map(thread => [thread.id, thread]))
  const newTriages = entries.flatMap(({ threadId, ...fields }): [string, ThreadTriage][] => {
    const thread = threads.get(threadId)

    return thread ? [[threadId, { ...fields, lastCommentUrl: lastCommentUrl(thread) }]] : []
  })
  const retriagedIds = new Set(newTriages.map(([threadId]) => threadId))
  const otherTriages = Object.entries(triage).filter(([threadId]) => !retriagedIds.has(threadId))
  const errors = newTriages.flatMap(([, { name }]) => {
    const holder = otherTriages.find(([, other]) => other.name === name)

    return holder ? [`The name ${name} is already the name of ${holder[0]} on this PR.`] : []
  })

  if (errors.length > 0) {
    return { errors }
  }

  return {
    triage: Object.fromEntries([...otherTriages, ...newTriages]),
    skipped: entries.filter(entry => !threads.has(entry.threadId)).map(entry => entry.threadId),
  }
}

export function triageStatus(thread: PrThread, triage: PrTriage): TriageStatus {
  const recorded = triage[thread.id]

  if (recorded === undefined) {
    return { kind: 'not-triaged' }
  }

  return { kind: recorded.lastCommentUrl === lastCommentUrl(thread) ? 'triaged' : 'changed', triage: recorded }
}

// Threads to triage: never triaged, or with a comment after their triage. Their handled mark is unknown.
export type FeedbackTally = { toTriage: PrThread[]; handled: number; total: number }

export function feedbackTally(threads: readonly PrThread[], triage: PrTriage): FeedbackTally {
  const statuses = threads.map(thread => ({ thread, status: triageStatus(thread, triage) }))

  return {
    toTriage: statuses.filter(({ status }) => status.kind !== 'triaged').map(({ thread }) => thread),
    handled: statuses.filter(({ status }) => status.kind === 'triaged' && status.triage.isHandled).length,
    total: threads.length,
  }
}
