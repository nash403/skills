import type { EngineInterface, RenderInput } from 'claude-code'

import type { FollowedPr, PrChange, PrRef, PrSnapshot, PrSummary, PrThread, PrTriage, PrWatch, ReplyDrafts } from '../../types'
import { approve, askFix, askReply, askReviewChanges, discardDraft, postDraft, resolveThread, unapprove } from './actions'
import { changeText } from './changes'
import { readPrDrafts } from './drafted'
import { followByHand, readFollowedPrs, refreshPr, select, unfollow } from './followed'
import { CI_LOOKS, IMPORTANCE_TONES, STATUS_LOOKS, TONES, avatarTone, displayName, initials, isBot } from './look'
import type { Tone } from './look'
import { explainPrompt, triagePrompt } from './prompts'
import type { ThreadTarget } from './prompts'
import { prKey, prLabel } from './refs'
import { headToReviewFrom, viewerApproval } from './pushes'
import { isPushedSinceApproval, isSkipCi, participants, statusChip, threadCounts } from './rules'
import { feedbackTally, triageStatus } from './triage'
import type { FeedbackTally, TriageStatus } from './triage'
import { readPrSummary } from './summarized'
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

// A filled chip: its own background, so it reads on a light or a dark theme alike.
function chip($: EngineInterface, e: PaneInput, text: string, tone: Tone, key?: string) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box key={key ?? text} backgroundColor={tone.bg} paddingX={1}>
      <Text color={tone.fg} bold>
        {text}
      </Text>
    </Box>
  )
}

// Initials on the person's own color, a gear for a bot.
function avatar($: EngineInterface, e: PaneInput, name: string) {
  return chip($, e, isBot(name) ? '⚙' : initials(name), isBot(name) ? TONES.slate : avatarTone(name), `avatar:${name}`)
}

function person($: EngineInterface, e: PaneInput, name: string, isViewer: boolean) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box key={`person:${name}`} flexDirection="row" columnGap={1}>
      {avatar($, e, name)}
      <Text bold={isViewer}>{isViewer ? 'you' : displayName(name)}</Text>
    </Box>
  )
}

function unseenDot($: EngineInterface, e: PaneInput) {
  const { Text } = $.ui.resolve(e)

  return (
    <Text bold color={TONES.fuchsia.bg}>
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
          <Text dimColor tabular>
            {index + 1}/{prs.length}
          </Text>
          {isAnotherUnseen && unseenDot($, e)}
        </Box>
      )}
      {hasMany && <Button key="next" label="›" plain onPress={() => void select($, next.ref)} />}
      {isUnseen(shown) && unseenDot($, e)}
      {url ? (
        <Link href={url}>
          <Text underline>{prLabel(shown.ref)} ↗</Text>
        </Link>
      ) : (
        <Text>{prLabel(shown.ref)}</Text>
      )}
      <Box flexGrow={1} />
      <Button key="refresh" label="↻" plain dimColor onPress={() => void refreshPr($, shown.ref)} />
      <Button key="remove" label="Unfollow" plain dimColor onPress={() => void unfollow($, shown.ref)} />
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

// The PR's vital signs: its CI and flags as chips, then the size of the diff and the threads.
function vitals($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const ci = pr.state === 'open' && pr.ci !== 'none' ? CI_LOOKS[pr.ci] : null
  const { open, total } = threadCounts(pr)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>
      {ci && chip($, e, ci.text, ci.tone)}
      {isPushedSinceApproval(pr) && chip($, e, '⚠ pushed since your approval', TONES.saffron)}
      {pr.isDraft && chip($, e, 'draft', TONES.slate)}
      {pr.blocked && chip($, e, `blocked: ${pr.blocked}`, TONES.signal)}
      {isSkipCi(pr.title, pr.headMessage) && chip($, e, 'skip CI', TONES.saffron)}
      <Box flexDirection="row" columnGap={1}>
        <Text color="diffAdded" tabular>
          +{pr.additions}
        </Text>
        <Text color="diffRemoved" tabular>
          −{pr.deletions}
        </Text>
      </Box>
      <Text dimColor>{pr.changedFiles === 1 ? '1 file' : `${pr.changedFiles} files`}</Text>
      <Text dimColor>{commitsLabel(pr)}</Text>
      <Text dimColor>
        threads {open}/{total}
        {pr.hasMoreThreads ? '+' : ''} open
      </Text>
    </Box>
  )
}

// The PR at a glance, framed in its status color: status and title, branches and author, what it does, its vitals.
function prCard($: EngineInterface, e: PaneInput, pr: PrSnapshot, summary: PrSummary | undefined) {
  const { Box, Text } = $.ui.resolve(e)
  const status = statusChip(pr)
  const look = STATUS_LOOKS[status]

  return (
    <Box flexDirection="column" rowGap={1} borderStyle="round" borderColor={look.tone.bg} paddingX={1}>
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={1} alignItems="flex-start">
          {chip($, e, `${look.glyph} ${status}`, look.tone, 'status')}
          <Box flexShrink={1}>
            <Text size="heading" weight="bold" wrap="wrap">
              {pr.title}
            </Text>
          </Box>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {person($, e, pr.author, pr.author === pr.viewer)}
          <Text dimColor wrap="truncate-middle">
            {pr.headBranch} → {pr.baseBranch}
          </Text>
        </Box>
      </Box>
      {summary && summary.text !== '' && <Text wrap="wrap">{summary.text}</Text>}
      {vitals($, e, pr)}
    </Box>
  )
}

// Who moves next. The user's move is the loudest thing in the pane; everyone else's reads quietly.
function nextStepLines($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const steps = nextSteps(pr)

  if (steps.length === 0) {
    return null
  }

  return (
    <Box flexDirection="column">
      {steps.map(({ actor, action }) =>
        actor === 'You' ? (
          <Box key={`${actor}: ${action}`} flexDirection="row" columnGap={1}>
            {chip($, e, 'your move', TONES.fuchsia, `move:${action}`)}
            <Text bold>{action}</Text>
          </Box>
        ) : (
          <Box key={`${actor}: ${action}`}>
            <Text dimColor>
              ◷ {actor}: {action}
            </Text>
          </Box>
        ),
      )}
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
    <Box flexDirection="column" borderStyle="round" borderColor={TONES.cobalt.bg} paddingX={1}>
      <Text bold color={TONES.cobalt.bg}>
        Changes since your last visit
      </Text>
      {changes.map(change => (
        <Box key={changeKey(change)} flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text>{changeText(change)}</Text>
          {changeAnswer($, e, view, change)}
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
    <Box flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Text bold color={TONES.cobalt.bg}>
          {name}
        </Text>
        <Text>{classification}</Text>
        {chip($, e, importance, IMPORTANCE_TONES[importance], `importance:${threadId}`)}
        <Text color={isHandled ? TONES.moss.bg : TONES.saffron.bg}>{isHandled ? '✓ handled' : 'not handled'}</Text>
        {status.kind === 'changed' && <Text color={TONES.saffron.bg}>new comment since triage</Text>}
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
    <Box flexDirection="column" borderStyle="round" borderColor={TONES.fuchsia.bg} paddingX={1}>
      <Text bold color={TONES.fuchsia.bg}>
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

function turnMark($: EngineInterface, e: PaneInput, threadId: string, isMine: boolean) {
  const { Text } = $.ui.resolve(e)

  return isMine ? chip($, e, 'your turn', TONES.fuchsia, `turn:${threadId}`) : <Text dimColor>◷ waiting</Text>
}

function threadRow($: EngineInterface, e: PaneInput, view: ThreadsView, { thread, firstComment, turn }: ConcerningThread) {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const status = triageStatus(thread, view.triage)
  const name = status.kind === 'not-triaged' ? null : status.triage.name
  const target: ThreadTarget = { ref: view.ref, pr: view.pr, thread, name }
  const draft = view.drafts[thread.id]

  return (
    <Box key={thread.id} flexDirection="column" rowGap={1}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {person($, e, firstComment.author, firstComment.author === view.pr.viewer)}
        {turnMark($, e, thread.id, isViewerTurn(turn))}
        <Link href={firstComment.url}>
          <Text dimColor underline>
            open ↗
          </Text>
        </Link>
        <Box flexGrow={1} />
        <Button key={`explain:${thread.id}`} label="Explain" plain dimColor onPress={() => submitPrompt($, explainPrompt(target))} />
        {isViewerPr(view.pr) && <Button key={`fix:${thread.id}`} label="Fix" plain dimColor onPress={() => void askFix($, target)} />}
        <Button key={`reply:${thread.id}`} label="Reply" plain dimColor onPress={() => void askReply($, target)} />
        <Button key={`resolve:${thread.id}`} label="Resolve" plain dimColor onPress={() => void resolveThread($, target)} />
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {status.kind === 'not-triaged' ? (
          <Text dimColor wrap="wrap">
            {excerpt(firstComment.body)}
          </Text>
        ) : (
          triageLines($, e, thread.id, status, view.openDetails.has(thread.id) ? 'open' : 'closed')
        )}
        {draft !== undefined && draftLines($, e, target, draft)}
      </Box>
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
    <Box flexDirection="column" rowGap={1}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text weight="bold" size="heading">
          Your open threads ({concerning.length})
        </Text>
        <Text color={tally.handled === tally.total ? TONES.moss.bg : undefined} dimColor={tally.handled !== tally.total}>
          {feedbackText(tally)}
        </Text>
        {toTriage.length > 0 && chip($, e, `${toTriage.length} to triage`, TONES.saffron, 'to-triage')}
        {toTriage.length > 0 && <Button key="triage" label="Triage" onPress={() => submitPrompt($, triagePrompt(view.ref, view.pr, toTriage))} />}
      </Box>
      {concerning.map(item => threadRow($, e, view, item))}
    </Box>
  )
}

// Everyone on the PR as a token: avatar, name, then a check when they approved and a diamond when they have commits.
function people($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1}>
      {participants(pr).map(participant => (
        <Box key={`participant:${participant.name}`} flexDirection="row" columnGap={1}>
          {person($, e, participant.name, participant.name === pr.viewer)}
          {participant.role === 'author' && <Text dimColor>author</Text>}
          {participant.hasApproved && <Text color={TONES.moss.bg}>✓ approved</Text>}
          {participant.hasCommits && participant.role !== 'author' && <Text dimColor>◆ commits</Text>}
        </Box>
      ))}
    </Box>
  )
}

function prView($: EngineInterface, e: PaneInput, followed: FollowedPr, view: ThreadsView | null, changes: readonly PrChange[], summary: PrSummary | undefined) {
  const { Box, Text } = $.ui.resolve(e)
  const pr = followed.snapshot

  return (
    <Box flexDirection="column" rowGap={1}>
      {view && changesBlock($, e, view, changes)}
      {pr === null && followed.error === null && <Text dimColor>Loading…</Text>}
      {followed.error !== null && <Text color={TONES.signal.bg}>Could not read it: {followed.error}</Text>}
      {pr && prCard($, e, pr, summary)}
      {pr && nextStepLines($, e, pr)}
      {pr && peerActions($, e, followed.ref, pr)}
      {pr && people($, e, pr)}
      {view && threadList($, e, view)}
    </Box>
  )
}

// A minimized pane on the desktop app: one line, and clicks may not reach it.
function glance($: EngineInterface, e: PaneInput, followed: FollowedPr | undefined, watches: Watches) {
  const { Text } = $.ui.resolve(e)
  const dot = Object.values(watches).some(hasUnseenChanges) ? <Text color={TONES.fuchsia.bg}>• </Text> : null

  if (!followed?.snapshot) {
    return (
      <Text dimColor>
        {dot}
        {followed ? prLabel(followed.ref) : 'No PR'}
      </Text>
    )
  }

  const status = statusChip(followed.snapshot)

  return (
    <Text>
      {dot}
      {prLabel(followed.ref)} <Text color={STATUS_LOOKS[status].tone.bg}>{status}</Text>
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
  const summary = shown ? await readPrSummary($, shown.ref) : undefined

  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      {shown ? switcher($, e, prs, selectedIndex, watches) : <Text dimColor>No PR yet. The PRs and MRs this session opens or mentions show up here.</Text>}
      {shown && prView($, e, shown, view, changes, summary)}
      <Input key="add" placeholder="Add a PR: number or URL" submitLabel="add" onSubmit={value => void followByHand($, value)} />
    </Box>
  )
}
