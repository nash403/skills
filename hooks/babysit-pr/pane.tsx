import type { Color, EngineInterface, RenderInput } from 'claude-code'

import type { CiState, FollowedPr, PrChange, PrRef, PrSnapshot, PrThread, PrTriage, PrWatch, ReplyDrafts, TriageImportance } from '../../types'
import { approve, askFix, askReply, askReviewChanges, discardDraft, postDraft, resolveThread, unapprove } from './actions'
import { changeText } from './changes'
import { readPrDrafts } from './drafted'
import { followByHand, readFollowedPrs, refreshPr, select, unfollow } from './followed'
import { explainPrompt, triagePrompt } from './prompts'
import type { ThreadTarget } from './prompts'
import { prKey, prLabel } from './refs'
import { headToReviewFrom, viewerApproval } from './pushes'
import { isPushedSinceApproval, isSkipCi, participants, statusChip, threadCounts } from './rules'
import type { StatusChip } from './rules'
import { feedbackTally, triageStatus } from './triage'
import type { FeedbackTally, TriageStatus } from './triage'
import { readPrTriage } from './triaged'
import { concerningThreads, excerpt, isViewerPr, isViewerTurn, nextSteps } from './turns'
import type { ConcerningThread } from './turns'
import { hasUnseenChanges, readWatches } from './watched'

type PaneInput = RenderInput<'Pane'>

// State the thread list needs, read ahead since helpers that draw are sync.
type ThreadsView = { ref: PrRef; pr: PrSnapshot; triage: PrTriage; drafts: ReplyDrafts; openDetails: ReadonlySet<string> }

type TriagedStatus = Exclude<TriageStatus, { kind: 'not-triaged' }>

type Watches = Record<string, PrWatch>

// Whether a triaged thread shows its longer summary, by thread id.
const detailsOpenFamily = { plugin: 'nash403-skills', key: 'isBabysitTriageOpen' } as const

const CHIP_COLORS: Record<StatusChip, Color> = {
  merged: 'merged',
  closed: 'inactive',
  approved: 'success',
  'approved + threads': 'success',
  updated: 'suggestion',
  reviewed: 'warning',
  resolved: 'success',
  opened: 'subtle',
}

const IMPORTANCE_COLORS: Record<TriageImportance, Color> = { high: 'error', medium: 'warning', low: 'inactive' }

const CI_TEXTS: Record<CiState, { text: string; color: Color }> = {
  none: { text: 'no CI', color: 'inactive' },
  starting: { text: 'CI starting', color: 'warning' },
  pending: { text: 'CI pending', color: 'warning' },
  ok: { text: 'CI ok', color: 'success' },
  error: { text: 'CI error', color: 'error' },
}

function unseenDot($: EngineInterface, e: PaneInput) {
  const { Text } = $.ui.resolve(e)

  return (
    <Text bold color="suggestion">
      •
    </Text>
  )
}

// A `•` beside the shown PR when it has changes the pane never showed, and beside the count when another PR has.
function switcher($: EngineInterface, e: PaneInput, prs: readonly FollowedPr[], index: number, watches: Watches) {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const shown = prs[index]

  if (!shown) {
    return null
  }

  const previous = prs[(index - 1 + prs.length) % prs.length] ?? shown
  const next = prs[(index + 1) % prs.length] ?? shown
  const url = shown.snapshot?.url
  const hasMany = prs.length > 1
  const isUnseen = (pr: FollowedPr) => hasUnseenChanges(watches[prKey(pr.ref)])
  const isAnotherUnseen = prs.some(pr => pr !== shown && isUnseen(pr))

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} width="100%">
      {hasMany && <Button key="previous" label="‹" plain onPress={() => void select($, previous.ref)} />}
      {hasMany && (
        <Box flexDirection="row" columnGap={1}>
          <Text dimColor>
            {index + 1}/{prs.length}
          </Text>
          {isAnotherUnseen && unseenDot($, e)}
        </Box>
      )}
      {hasMany && <Button key="next" label="›" plain onPress={() => void select($, next.ref)} />}
      {isUnseen(shown) && unseenDot($, e)}
      {url ? (
        <Link href={url}>
          <Text bold>{prLabel(shown.ref)} ↗</Text>
        </Link>
      ) : (
        <Text bold>{prLabel(shown.ref)}</Text>
      )}
      <Box flexGrow={1} />
      <Button key="refresh" label="↻" plain dimColor onPress={() => void refreshPr($, shown.ref)} />
      <Button key="remove" label="✕" plain dimColor onPress={() => void unfollow($, shown.ref)} />
    </Box>
  )
}

function stateLine($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const chip = statusChip(pr)
  const ci = CI_TEXTS[pr.ci]

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Text color={CHIP_COLORS[chip]} inverse bold>
        {` ${chip} `}
      </Text>
      {isPushedSinceApproval(pr) && <Text color="warning">⚠ pushed since your approval</Text>}
      {pr.state === 'open' && <Text color={ci.color}>{ci.text}</Text>}
      {pr.isDraft && <Text color="inactive">draft</Text>}
      {pr.blocked && <Text color="error">blocked: {pr.blocked}</Text>}
      {isSkipCi(pr.title, pr.headMessage) && <Text color="warning">skip CI</Text>}
    </Box>
  )
}

// On a peer's open PR: the Approve / Unapprove toggle, and Review changes once code was pushed since the viewer's review.
function peerActions($: EngineInterface, e: PaneInput, ref: PrRef, pr: PrSnapshot) {
  const { Box, Button } = $.ui.resolve(e)

  if (pr.state !== 'open' || isViewerPr(pr)) {
    return null
  }

  const approval = viewerApproval(pr)
  const fromSha = headToReviewFrom(pr)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {approval ? (
        <Button key="unapprove" label="Unapprove" plain dimColor onPress={() => void unapprove($, ref, approval)} />
      ) : (
        <Button key="approve" label="Approve" variant="primary" onPress={() => void approve($, ref, pr.headSha)} />
      )}
      {fromSha !== null && <Button key="review-changes" label="Review changes" onPress={() => void askReviewChanges($, ref, pr, fromSha)} />}
    </Box>
  )
}

// Still true when drawn: on a peer's open PR, no approval from the viewer and none of their threads open again.
function canApproveResolved(pr: PrSnapshot) {
  return pr.state === 'open' && !isViewerPr(pr) && viewerApproval(pr) === undefined && concerningThreads(pr).length === 0
}

// The threads of a change that still wait for a triage.
function threadsToTriage({ pr, triage }: ThreadsView, threadIds: readonly string[]) {
  const { toTriage } = feedbackTally(concerningThreads(pr).map(item => item.thread), triage)

  return toTriage.filter(thread => threadIds.includes(thread.id))
}

// The button that answers a change, when its action still applies. Approvals given or withdrawn are news only.
function changeAnswer($: EngineInterface, e: PaneInput, view: ThreadsView, change: PrChange) {
  const { Button } = $.ui.resolve(e)
  const { ref, pr } = view

  switch (change.kind) {
    case 'code-pushed': {
      const fromSha = headToReviewFrom(pr)

      return fromSha === null ? null : <Button key="changes:review-changes" label="Review changes" onPress={() => void askReviewChanges($, ref, pr, fromSha)} />
    }
    case 'replied':
    case 'mentioned': {
      const toTriage = threadsToTriage(view, change.threadIds)

      return toTriage.length === 0 ? null : (
        <Button key={`changes:triage:${change.kind}:${change.author}`} label="Triage" onPress={() => submitPrompt($, triagePrompt(ref, pr, toTriage))} />
      )
    }
    case 'threads-resolved':
      return canApproveResolved(pr) ? <Button key="changes:approve" label="Approve" onPress={() => void approve($, ref, pr.headSha)} /> : null
    default:
      return null
  }
}

function changeKey(change: PrChange) {
  switch (change.kind) {
    case 'replied':
    case 'mentioned':
      return `change:${change.kind}:${change.author}`
    case 'approved':
    case 'unapproved':
      return `change:approval:${change.user}`
    default:
      return `change:${change.kind}`
  }
}

// What changed since the user last acted on the PR in the pane, each change with the button that answers it.
function changesBlock($: EngineInterface, e: PaneInput, view: ThreadsView, changes: readonly PrChange[]) {
  const { Box, Text } = $.ui.resolve(e)

  if (changes.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column">
      <Text bold color="suggestion">
        Changes since your last visit
      </Text>
      {changes.map(change => (
        <Box key={changeKey(change)} flexDirection="row" flexWrap="wrap" columnGap={2} paddingLeft={2}>
          <Text>{changeText(change)}</Text>
          {changeAnswer($, e, view, change)}
        </Box>
      ))}
    </Box>
  )
}

// Past the query's cap, the count reads `100+`.
function commitsLabel({ commits, hasMoreCommits }: PrSnapshot) {
  if (commits.length === 1) {
    return '1 commit'
  }

  return `${commits.length}${hasMoreCommits ? '+' : ''} commits`
}

function countsLine($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const { open, total } = threadCounts(pr)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Text color="diffAdded">+{pr.additions}</Text>
      <Text color="diffRemoved">−{pr.deletions}</Text>
      <Text dimColor>{pr.changedFiles === 1 ? '1 file' : `${pr.changedFiles} files`}</Text>
      <Text dimColor>{commitsLabel(pr)}</Text>
      <Text dimColor>
        threads {open}/{total}
        {pr.hasMoreThreads ? '+' : ''} open
      </Text>
    </Box>
  )
}

function nextStepLines($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const steps = nextSteps(pr)

  if (steps.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column">
      {steps.map(({ actor, action }) => (
        <Box key={`${actor}: ${action}`}>
          <Text bold={actor === 'You'} color={actor === 'You' ? 'suggestion' : 'subtle'}>
            → {actor}: {action}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

async function readOpenDetails($: EngineInterface, threads: readonly PrThread[]) {
  const reads = await Promise.all(threads.map(async ({ id }) => ({ id, isOpen: (await $.state.get({ ...detailsOpenFamily, id })).value })))

  return new Set(reads.filter(({ isOpen }) => isOpen === true).map(({ id }) => id))
}

async function toggleDetails($: EngineInterface, threadId: string) {
  const { value: isOpen = false } = await $.state.get({ ...detailsOpenFamily, id: threadId })
  await $.state.set({ ...detailsOpenFamily, id: threadId }, !isOpen)
}

function submitPrompt($: EngineInterface, text: string) {
  void $.prompt.submit({ text, asUser: true })
}

function triageLines($: EngineInterface, e: PaneInput, threadId: string, status: TriagedStatus, details: 'open' | 'closed') {
  const { Box, Button, Text } = $.ui.resolve(e)
  const { name, classification, importance, isHandled, summary } = status.triage
  const isOpen = details === 'open'

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text bold color="suggestion">
          {name}
        </Text>
        <Text>{classification}</Text>
        <Text color={IMPORTANCE_COLORS[importance]}>{importance}</Text>
        <Text color={isHandled ? 'success' : 'warning'}>{isHandled ? '✓ handled' : 'not handled'}</Text>
        {status.kind === 'changed' && <Text color="warning">new comment since triage</Text>}
      </Box>
      <Box flexDirection="row" columnGap={1}>
        <Text wrap="wrap">{summary}</Text>
        <Button key={`more:${threadId}`} label={isOpen ? 'less' : 'more'} plain dimColor onPress={() => void toggleDetails($, threadId)} />
      </Box>
      {isOpen && (
        <Text dimColor wrap="wrap">
          {status.triage.details}
        </Text>
      )}
    </Box>
  )
}

// `body` is passed to Post and Discard so they act on the draft drawn, not on one the model wrote since.
function draftLines($: EngineInterface, e: PaneInput, target: ThreadTarget, body: string) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const threadId = target.thread.id

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text bold color="suggestion">
        Draft reply
      </Text>
      <Text wrap="wrap">{body}</Text>
      <Box flexDirection="row" columnGap={2}>
        <Button key={`post:${threadId}`} label="Post" variant="primary" onPress={() => void postDraft($, target, body)} />
        <Button key={`discard:${threadId}`} label="Discard" plain dimColor onPress={() => void discardDraft($, target, body)} />
      </Box>
    </Box>
  )
}

function threadRow($: EngineInterface, e: PaneInput, view: ThreadsView, { thread, firstComment, turn }: ConcerningThread) {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const status = triageStatus(thread, view.triage)
  const name = status.kind === 'not-triaged' ? null : status.triage.name
  const target: ThreadTarget = { ref: view.ref, pr: view.pr, thread, name }
  const draft = view.drafts[thread.id]

  return (
    <Box key={thread.id} flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text bold>{firstComment.author}</Text>
        <Text color={isViewerTurn(turn) ? 'suggestion' : 'inactive'}>{isViewerTurn(turn) ? 'your turn' : 'waiting'}</Text>
        <Link href={firstComment.url}>
          <Text dimColor>↗</Text>
        </Link>
        <Button
          key={`explain:${thread.id}`}
          label="Explain"
          plain
          dimColor
          onPress={() => submitPrompt($, explainPrompt(target))}
        />
        {isViewerPr(view.pr) && <Button key={`fix:${thread.id}`} label="Fix" plain dimColor onPress={() => void askFix($, target)} />}
        <Button key={`reply:${thread.id}`} label="Reply" plain dimColor onPress={() => void askReply($, target)} />
        <Button key={`resolve:${thread.id}`} label="Resolve" plain dimColor onPress={() => void resolveThread($, target)} />
      </Box>
      {status.kind === 'not-triaged' ? (
        <Box paddingLeft={2}>
          <Text dimColor wrap="wrap">
            {excerpt(firstComment.body)}
          </Text>
        </Box>
      ) : (
        triageLines($, e, thread.id, status, view.openDetails.has(thread.id) ? 'open' : 'closed')
      )}
      {draft !== undefined && draftLines($, e, target, draft)}
    </Box>
  )
}

function feedbackText({ toTriage, handled, total }: FeedbackTally) {
  if (handled === total) {
    return '✓ all feedback handled'
  }

  return `${handled} of ${total} handled${toTriage.length > 0 ? `, ${toTriage.length} unknown` : ''}`
}

function threadList($: EngineInterface, e: PaneInput, view: ThreadsView) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const concerning = concerningThreads(view.pr)

  if (concerning.length === 0) {
    return null
  }

  const tally = feedbackTally(concerning.map(item => item.thread), view.triage)
  const { toTriage } = tally

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text bold>Your open threads ({concerning.length})</Text>
        <Text color={tally.handled === tally.total ? 'success' : 'subtle'}>{feedbackText(tally)}</Text>
        {toTriage.length > 0 && (
          <Fragment>
            <Text color="warning" inverse>
              {` ${toTriage.length} to triage `}
            </Text>
            <Button key="triage" label="Triage" onPress={() => submitPrompt($, triagePrompt(view.ref, view.pr, toTriage))} />
          </Fragment>
        )}
      </Box>
      {concerning.map(item => threadRow($, e, view, item))}
    </Box>
  )
}

function participantRows($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const people = participants(pr)
  const width = Math.max(...people.map(person => person.name.length))

  return (
    <Box flexDirection="column">
      {people.map(person => (
        <Box key={person.name} flexDirection="row" columnGap={2}>
          <Text bold={person.name === pr.viewer}>{person.name.padEnd(width)}</Text>
          <Text dimColor>{person.role.padEnd(8)}</Text>
          {person.hasApproved && <Text color="success">✓ approved</Text>}
          {person.hasCommits && <Text dimColor>has commits</Text>}
        </Box>
      ))}
    </Box>
  )
}

function prView($: EngineInterface, e: PaneInput, followed: FollowedPr, view: ThreadsView | null, changes: readonly PrChange[]) {
  const { Box, Text } = $.ui.resolve(e)
  const pr = followed.snapshot

  return (
    <Box flexDirection="column" rowGap={1}>
      {view && changesBlock($, e, view, changes)}
      {pr === null && followed.error === null && <Text dimColor>Loading…</Text>}
      {followed.error !== null && <Text color="error">Could not read it: {followed.error}</Text>}
      {pr && (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {pr.title}
          </Text>
          <Text dimColor>
            {pr.headBranch} → {pr.baseBranch}
          </Text>
        </Box>
      )}
      {pr && stateLine($, e, pr)}
      {pr && nextStepLines($, e, pr)}
      {pr && peerActions($, e, followed.ref, pr)}
      {pr && countsLine($, e, pr)}
      {pr && participantRows($, e, pr)}
      {view && threadList($, e, view)}
    </Box>
  )
}

// A minimized pane on the desktop app: one line, and clicks may not reach it.
function glance($: EngineInterface, e: PaneInput, followed: FollowedPr | undefined, watches: Watches) {
  const { Text } = $.ui.resolve(e)
  const dot = Object.values(watches).some(hasUnseenChanges) ? <Text color="suggestion">• </Text> : null

  if (!followed?.snapshot) {
    return (
      <Text dimColor>
        {dot}
        {followed ? prLabel(followed.ref) : 'No PR'}
      </Text>
    )
  }

  const chip = statusChip(followed.snapshot)

  return (
    <Text>
      {dot}
      {prLabel(followed.ref)} <Text color={CHIP_COLORS[chip]}>{chip}</Text>
    </Text>
  )
}

async function readThreadsView($: EngineInterface, ref: PrRef, pr: PrSnapshot): Promise<ThreadsView> {
  const triage = await readPrTriage($, ref)
  const drafts = await readPrDrafts($, ref)
  // Only a triaged thread has a longer summary to open.
  const openDetails = await readOpenDetails($, pr.threads.filter(thread => !thread.isResolved && thread.id in triage))

  return { ref, pr, triage, drafts, openDetails }
}

export async function drawPane($: EngineInterface, e: PaneInput) {
  const { Box, Input, Text } = $.ui.resolve(e)
  const { prs, selectedIndex } = await readFollowedPrs($)
  const watches = await readWatches($)
  const shown = prs[selectedIndex]

  if (e.props.placement === 'widget') {
    return glance($, e, shown, watches)
  }

  const view = shown?.snapshot ? await readThreadsView($, shown.ref, shown.snapshot) : null
  const changes = shown ? (watches[prKey(shown.ref)]?.changes ?? []) : []

  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      {shown ? switcher($, e, prs, selectedIndex, watches) : <Text dimColor>No PR yet. The PRs and MRs this session opens or mentions show up here.</Text>}
      {shown && prView($, e, shown, view, changes)}
      <Input key="add" placeholder="Add a PR: number or URL" submitLabel="add" onSubmit={value => void followByHand($, value)} />
    </Box>
  )
}
