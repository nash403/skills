import type { EngineInterface, RenderChildren, RenderInput, Space } from 'claude-code'

import type { FollowedPr, PrChange, PrRef, PrSnapshot, PrSummary, PrThread, PrTriage, PrWatch, ReplyDrafts } from '../../types'
import { approve, askFix, askReply, askReviewChanges, discardDraft, postDraft, resolveThread, unapprove } from './actions'
import { changeText } from './changes'
import { readPrDrafts } from './drafted'
import { followByHand, readFollowedPrs, refreshPr, select, unfollow } from './followed'
import { CI_LOOKS, GLYPHS, IMPORTANCE_TONES, STATUS_LOOKS, TONES, avatarSvg, avatarTone, diffBarSvg, diffBlocks, displayName, iconSvg, initials, isBot, settledThreadsSvg } from './look'
import type { IconName, Tone } from './look'
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

// Off the terminal a chip is a rounded pill. The terminal keeps it flat: a border there costs two rows.
function isCellSurface(e: PaneInput) {
  return e.surface === 'terminal'
}

const ICON_SIZE = 14

// A filled chip: its own background, so it reads on a light or a dark theme alike. Its icon is drawn at the text's
// height where the surface draws an Svg: a glyph there renders smaller than the letters beside it.
function chip($: EngineInterface, e: PaneInput, text: string, tone: Tone, { key, icon }: { key?: string; icon?: IconName } = {}) {
  const table = $.ui.resolve(e)
  const { Box, Text } = table
  const pill = isCellSurface(e) ? {} : { borderStyle: 'round', borderColor: tone.bg }
  const drawsIcon = icon !== undefined && !isCellSurface(e) && 'Svg' in table

  return (
    <Box key={key ?? text} flexDirection="row" columnGap="xs" alignItems="center" backgroundColor={tone.bg} paddingX={isCellSurface(e) ? 1 : 'xs'} {...pill}>
      {drawsIcon && <table.Svg source={iconSvg(icon, tone.fg, ICON_SIZE)} alt="" width={ICON_SIZE} height={ICON_SIZE} />}
      <Text color={tone.fg} bold>
        {icon !== undefined && !drawsIcon ? `${GLYPHS[icon]} ${text}` : text}
      </Text>
    </Box>
  )
}

// A section's title: small, dim and in capitals, so the content under it carries the weight.
function sectionTitle($: EngineInterface, e: PaneInput, title: string, aside?: RenderChildren) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center">
      <Text size="caption" weight="semibold" dimColor>
        {title.toUpperCase()}
      </Text>
      {aside}
    </Box>
  )
}

// A tone washed out to a surface: translucent, so it tints a light or a dark theme alike.
function tint(tone: Tone, strength: 'faint' | 'soft' = 'faint') {
  return `${tone.bg}${strength === 'faint' ? '14' : '24'}`
}

type SlabOptions = { key?: string; rail?: string; wash?: string; gap?: Space; children: RenderChildren }

// A section's surface: a rounded tinted slab with a colored rail down its left edge. The terminal keeps the rail
// alone: a filled background there paints whole rows in a color the person's theme never chose.
function slab($: EngineInterface, e: PaneInput, { key, rail, wash = tint(TONES.slate), gap = 'md', children }: SlabOptions) {
  const { Box } = $.ui.resolve(e)
  const isCells = isCellSurface(e)
  const surface = isCells ? {} : ({ backgroundColor: wash, borderStyle: 'round', borderColor: wash, overflow: 'hidden' } as const)

  return (
    <Box key={key} flexDirection="row" {...surface}>
      {rail !== undefined && <Box width={1} flexShrink={0} backgroundColor={rail} />}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} rowGap={gap} paddingX={isCells ? 1 : 'md'} paddingY={isCells ? 0 : 'sm'}>
        {children}
      </Box>
    </Box>
  )
}

// No thread concerns the viewer: a short line under a small drawing of a settled conversation, where the surface
// draws an Svg, so the section keeps its place without a paragraph.
function noThreads($: EngineInterface, e: PaneInput) {
  const table = $.ui.resolve(e)
  const { Box, Text } = table
  const text = 'No open threads of yours'

  return (
    <Box key="threads-empty" flexDirection="column" rowGap="sm" alignItems="center" borderStyle="dashed" borderColor="subtle" paddingX="md" paddingY="md">
      {'Svg' in table ? <table.Svg source={settledThreadsSvg()} alt={text} width={44} height={32} /> : <Text dimColor>💬</Text>}
      <Text dimColor>{text}</Text>
    </Box>
  )
}

const AVATAR_SIZE = 18

// Initials on the person's own color, a gear for a bot: a disc as tall as a line of text where the surface draws an
// Svg, a one-cell-padded block on the terminal.
function avatar($: EngineInterface, e: PaneInput, name: string) {
  const table = $.ui.resolve(e)
  const { Box, Text } = table
  const tone = isBot(name) ? TONES.slate : avatarTone(name)
  const letters = isBot(name) ? '⚙' : initials(name)

  if (!isCellSurface(e) && 'Svg' in table) {
    return <table.Svg key={`avatar:${name}`} source={avatarSvg(letters, tone, AVATAR_SIZE)} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} />
  }

  return (
    <Box key={`avatar:${name}`} backgroundColor={tone.bg} paddingX={1}>
      <Text color={tone.fg} bold>
        {letters}
      </Text>
    </Box>
  )
}

function person($: EngineInterface, e: PaneInput, name: string, isViewer: boolean) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box key={`person:${name}`} flexDirection="row" columnGap="sm" alignItems="center">
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
    <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center" width="100%">
      {hasMany && (
        <Box flexDirection="row" columnGap="sm" alignItems="center">
          <Button key="previous" label="‹" plain onPress={() => void select($, previous.ref)} />
          <Text dimColor tabular>
            {index + 1}/{prs.length}
          </Text>
          {isAnotherUnseen && unseenDot($, e)}
          <Button key="next" label="›" plain onPress={() => void select($, next.ref)} />
        </Box>
      )}
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
function commitCount({ commits, hasMoreCommits }: PrSnapshot) {
  return `${commits.length}${hasMoreCommits ? '+' : ''}`
}

// The PR's flags as chips: its CI, then what holds it back.
function flags($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box } = $.ui.resolve(e)
  const ci = pr.state === 'open' && pr.ci !== 'none' ? CI_LOOKS[pr.ci] : null
  const items = [
    ci && chip($, e, ci.text, ci.tone, { icon: ci.icon }),
    isPushedSinceApproval(pr) && chip($, e, 'pushed since your approval', TONES.saffron, { icon: 'warning' }),
    pr.isDraft && chip($, e, 'draft', TONES.slate, { icon: 'half' }),
    pr.blocked && chip($, e, `blocked: ${pr.blocked}`, TONES.signal, { icon: 'ban' }),
    isSkipCi(pr.title, pr.headMessage) && chip($, e, 'skip CI', TONES.saffron, { icon: 'skip' }),
  ].filter(Boolean)

  if (items.length === 0) {
    return null
  }

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="sm">
      {items}
    </Box>
  )
}

// One figure of the stat strip: the value large, what it counts small beneath.
function tile($: EngineInterface, e: PaneInput, key: string, value: RenderChildren, label: RenderChildren) {
  const { Box } = $.ui.resolve(e)
  const surface = isCellSurface(e)
    ? {}
    : ({ backgroundColor: tint(TONES.slate), borderStyle: 'round', borderColor: tint(TONES.slate), paddingX: 'md', paddingY: 'sm' } as const)

  return (
    <Box key={key} flexDirection="column" rowGap="xs" minWidth={10} {...surface}>
      {value}
      {label}
    </Box>
  )
}

// The diff's shares under its line counts: a rounded bar where the surface draws an Svg, five blocks on the terminal.
function diffBar($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const table = $.ui.resolve(e)
  const { Box, Text } = table
  const alt = `${pr.additions} lines added, ${pr.deletions} removed`

  if ('Svg' in table) {
    const { Svg } = table

    return <Svg source={diffBarSvg(pr.additions, pr.deletions, 64, 6)} alt={alt} width={64} height={6} />
  }

  const { added, removed, neutral } = diffBlocks(pr.additions, pr.deletions)

  return (
    <Box flexDirection="row">
      <Text color="diffAdded">{'■'.repeat(added)}</Text>
      <Text color="diffRemoved">{'■'.repeat(removed)}</Text>
      <Text dimColor>{'■'.repeat(neutral)}</Text>
    </Box>
  )
}

// The size of the change in one strip: lines with their diff bar, files, commits, then the open threads.
function stats($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const { open, total } = threadCounts(pr)
  const figure = (text: string) => (
    <Text size="heading" weight="semibold" tabular>
      {text}
    </Text>
  )
  const caption = (text: string) => (
    <Text size="caption" dimColor>
      {text}
    </Text>
  )
  const lines = (
    <Box flexDirection="row" columnGap="sm">
      <Text size="heading" weight="semibold" color="diffAdded" tabular>
        +{pr.additions}
      </Text>
      <Text size="heading" weight="semibold" color="diffRemoved" tabular>
        −{pr.deletions}
      </Text>
    </Box>
  )

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={isCellSurface(e) ? 'xl' : 'sm'} rowGap="sm">
      {tile($, e, 'stat:lines', lines, diffBar($, e, pr))}
      {tile($, e, 'stat:files', figure(String(pr.changedFiles)), caption(pr.changedFiles === 1 ? 'file' : 'files'))}
      {tile($, e, 'stat:commits', figure(commitCount(pr)), caption(pr.commits.length === 1 ? 'commit' : 'commits'))}
      {tile($, e, 'stat:threads', figure(`${open}/${total}${pr.hasMoreThreads ? '+' : ''}`), caption('open threads'))}
    </Box>
  )
}

// The PR at a glance, framed in its status color: status over the title, author and branches, what it does, its
// flags and the size of the change. The status sits on its own row: beside a title that wraps, it would hang off its
// first line.
function prCard($: EngineInterface, e: PaneInput, pr: PrSnapshot, summary: PrSummary | undefined) {
  const { Box, Text } = $.ui.resolve(e)
  const status = statusChip(pr)
  const look = STATUS_LOOKS[status]

  return slab($, e, {
    rail: look.tone.bg,
    wash: tint(look.tone),
    children: [
      <Box key="head" flexDirection="column" rowGap="sm">
        <Box flexDirection="row">{chip($, e, status, look.tone, { key: 'status', icon: look.icon })}</Box>
        <Text size="heading" weight="bold" wrap="wrap">
          {pr.title}
        </Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center">
          {person($, e, pr.author, pr.author === pr.viewer)}
          <Text dimColor wrap="truncate-middle">
            {pr.headBranch} → {pr.baseBranch}
          </Text>
        </Box>
      </Box>,
      summary && summary.text !== '' && (
        <Text key="summary" wrap="wrap">
          {summary.text}
        </Text>
      ),
      summary && summary.text === '' && (
        <Text key="summary" dimColor italic>
          No description.
        </Text>
      ),
      flags($, e, pr),
      stats($, e, pr),
    ],
  })
}

// While the first read runs: the card's frame with gray bars where its lines will be.
function loadingCard($: EngineInterface, e: PaneInput, ref: PrRef) {
  const { Box, Text } = $.ui.resolve(e)

  return slab($, e, {
    rail: 'subtle',
    children: (
      <Box flexDirection="column" rowGap="md">
        <Text dimColor>Reading {prLabel(ref)}…</Text>
        <Box flexDirection="column" rowGap="sm">
          <Text dimColor>{'━'.repeat(28)}</Text>
          <Text dimColor>{'━'.repeat(18)}</Text>
        </Box>
      </Box>
    ),
  })
}

// Who moves next, with the viewer's own buttons. The user's move is the loudest thing in the pane: its slab and its
// arrow take the one color nothing else uses, and it reads as a heading, not as one more status chip. Everyone
// else's reads quietly.
function nextBlock($: EngineInterface, e: PaneInput, ref: PrRef, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const steps = nextSteps(pr)
  const actions = peerActions($, e, ref, pr)

  if (steps.length === 0 && actions === null) {
    return null
  }

  const isMyMove = steps.some(({ actor }) => actor === 'You')

  return slab($, e, {
    rail: isMyMove ? TONES.fuchsia.bg : undefined,
    wash: isMyMove ? tint(TONES.fuchsia) : tint(TONES.slate),
    gap: 'sm',
    children: (
      <Box flexDirection="column" rowGap="sm">
        {isMyMove && (
          <Text size="caption" weight="semibold" color={TONES.fuchsia.bg}>
            YOUR MOVE
          </Text>
        )}
        {steps.map(({ actor, action }) =>
          actor === 'You' ? (
            <Box key={`${actor}: ${action}`} flexDirection="row" columnGap="sm">
              <Text bold color={TONES.fuchsia.bg}>
                ➜
              </Text>
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
        {actions}
      </Box>
    ),
  })
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
    <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm">
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

  return slab($, e, {
    rail: TONES.cobalt.bg,
    wash: tint(TONES.cobalt),
    gap: 'sm',
    children: [
      <Text key="title" bold color={TONES.cobalt.bg}>
        Changes since your last visit
      </Text>,
      ...changes.map(change => (
        <Box key={changeKey(change)} flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center">
          <Text>{changeText(change)}</Text>
          {changeAnswer($, e, view, change)}
        </Box>
      )),
    ],
  })
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

  // The classification leads: it is what the triage concluded. The name trails, small, for referring to the thread.
  return (
    <Box flexDirection="column" rowGap="sm">
      <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center">
        <Text weight="semibold">{classification}</Text>
        <Text size="caption">
          <Text color={IMPORTANCE_TONES[importance].bg}>●</Text> {importance}
        </Text>
        <Text size="caption" weight="semibold" color={isHandled ? TONES.moss.bg : TONES.signal.bg}>
          {isHandled ? '✓ handled' : '✗ not handled'}
        </Text>
        {status.kind === 'changed' && (
          <Text size="caption" color={TONES.saffron.bg}>
            new comment since triage
          </Text>
        )}
        <Box flexGrow={1} />
        <Text size="caption" mono dimColor>
          {name}
        </Text>
      </Box>
      <Box flexDirection="row" columnGap="sm">
        <Box flexShrink={1}>
          <Text wrap="wrap">{summary}</Text>
        </Box>
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

  return slab($, e, {
    rail: TONES.fuchsia.bg,
    wash: tint(TONES.fuchsia),
    gap: 'sm',
    children: [
      <Text key="title" size="caption" weight="semibold" color={TONES.fuchsia.bg}>
        DRAFT REPLY
      </Text>,
      <Text key="body" wrap="wrap">
        {body}
      </Text>,
      <Box key="buttons" flexDirection="row" columnGap="md">
        <Button key={`post:${threadId}`} label="Post" variant="primary" onPress={() => void postDraft($, target, body)} />
        <Button key={`discard:${threadId}`} label="Discard" plain dimColor onPress={() => void discardDraft($, target, body)} />
      </Box>,
    ],
  })
}

function turnMark($: EngineInterface, e: PaneInput, threadId: string, isMine: boolean) {
  const { Text } = $.ui.resolve(e)

  return isMine ? (
    <Text key={`turn:${threadId}`} size="caption" weight="semibold" color={TONES.fuchsia.bg}>
      ➜ your turn
    </Text>
  ) : (
    <Text key={`turn:${threadId}`} size="caption" dimColor>
      ◷ waiting
    </Text>
  )
}

// One thread as a card: who opened it and whose turn it is, what it says, then what can be done about it. A thread
// that waits on the viewer is framed in their color.
function threadRow($: EngineInterface, e: PaneInput, view: ThreadsView, { thread, firstComment, turn }: ConcerningThread) {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const status = triageStatus(thread, view.triage)
  const name = status.kind === 'not-triaged' ? null : status.triage.name
  const target: ThreadTarget = { ref: view.ref, pr: view.pr, thread, name }
  const draft = view.drafts[thread.id]
  const isMine = isViewerTurn(turn)

  return slab($, e, {
    key: thread.id,
    rail: isMine ? TONES.fuchsia.bg : TONES.slate.bg,
    children: [
      <Box key="head" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm" alignItems="center">
        {person($, e, firstComment.author, firstComment.author === view.pr.viewer)}
        {turnMark($, e, thread.id, isMine)}
        <Box flexGrow={1} />
        <Link href={firstComment.url}>
          <Text dimColor underline>
            open ↗
          </Text>
        </Link>
      </Box>,
      status.kind === 'not-triaged' ? (
        <Text key="body" dimColor wrap="wrap" maxLines={4}>
          {excerpt(firstComment.body)}
        </Text>
      ) : (
        triageLines($, e, thread.id, status, view.openDetails.has(thread.id) ? 'open' : 'closed')
      ),
      draft !== undefined && draftLines($, e, target, draft),
      <Box key="actions" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="sm">
        <Button key={`explain:${thread.id}`} label="Explain" plain dimColor onPress={() => submitPrompt($, explainPrompt(target))} />
        {isViewerPr(view.pr) && <Button key={`fix:${thread.id}`} label="Fix" plain dimColor onPress={() => void askFix($, target)} />}
        <Button key={`reply:${thread.id}`} label="Reply" plain dimColor onPress={() => void askReply($, target)} />
        <Button key={`resolve:${thread.id}`} label="Resolve" plain dimColor onPress={() => void resolveThread($, target)} />
      </Box>,
    ],
  })
}

function feedbackText({ toTriage, handled, total }: FeedbackTally) {
  if (handled === total) {
    return '✓ all feedback handled'
  }

  return `${handled} of ${total} handled${toTriage.length > 0 ? `, ${toTriage.length} unknown` : ''}`
}

// The threads that concern the viewer, under a title with the tally and the Triage button; a placeholder until one does.
function threadList($: EngineInterface, e: PaneInput, view: ThreadsView) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const concerning = concerningThreads(view.pr)

  if (concerning.length === 0) {
    return (
      <Box flexDirection="column" rowGap="sm">
        {sectionTitle($, e, 'Your open threads')}
        {noThreads($, e)}
      </Box>
    )
  }

  const tally = feedbackTally(concerning.map(item => item.thread), view.triage)
  const { toTriage } = tally
  const aside = [
    <Text key="count" size="caption" dimColor tabular>
      {concerning.length}
    </Text>,
    <Text key="tally" color={tally.handled === tally.total ? TONES.moss.bg : undefined} dimColor={tally.handled !== tally.total}>
      {feedbackText(tally)}
    </Text>,
    toTriage.length > 0 && chip($, e, `${toTriage.length} to triage`, TONES.saffron, { key: 'to-triage' }),
    toTriage.length > 0 && <Button key="triage" label="Triage" onPress={() => submitPrompt($, triagePrompt(view.ref, view.pr, toTriage))} />,
  ]

  return (
    <Box flexDirection="column" rowGap="sm">
      {sectionTitle($, e, 'Your open threads', aside)}
      {concerning.map(item => threadRow($, e, view, item))}
    </Box>
  )
}

// Everyone on the PR as a token: avatar, name, then a check when they approved and a diamond when they have commits.
function people($: EngineInterface, e: PaneInput, pr: PrSnapshot) {
  const { Box, Text } = $.ui.resolve(e)
  const all = participants(pr)

  return (
    <Box flexDirection="column" rowGap="sm">
      {sectionTitle($, e, 'People')}
      {slab($, e, {
        children: (
          <Box flexDirection="row" flexWrap="wrap" columnGap="lg" rowGap="sm">
            {all.map(participant => (
              <Box key={`participant:${participant.name}`} flexDirection="row" columnGap="sm" alignItems="center">
                {person($, e, participant.name, participant.name === pr.viewer)}
                {participant.role === 'author' && <Text dimColor>author</Text>}
                {participant.hasApproved && <Text color={TONES.moss.bg}>✓ approved</Text>}
                {participant.hasCommits && participant.role !== 'author' && <Text dimColor>◆ commits</Text>}
              </Box>
            ))}
          </Box>
        ),
      })}
    </Box>
  )
}

function prView(
  $: EngineInterface,
  e: PaneInput,
  followed: FollowedPr,
  view: ThreadsView | null,
  changes: readonly PrChange[],
  summary: PrSummary | undefined,
) {
  const { Box, Text } = $.ui.resolve(e)
  const pr = followed.snapshot

  return (
    <Box flexDirection="column" rowGap="lg">
      {view && changesBlock($, e, view, changes)}
      {pr === null && followed.error === null && loadingCard($, e, followed.ref)}
      {followed.error !== null &&
        slab($, e, {
          rail: TONES.signal.bg,
          wash: tint(TONES.signal),
          children: (
            <Text color={TONES.signal.bg} wrap="wrap">
              Could not read it: {followed.error}
            </Text>
          ),
        })}
      {pr && prCard($, e, pr, summary)}
      {pr && nextBlock($, e, followed.ref, pr)}
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

// No PR followed yet: what the pane is for and where its PRs come from.
function emptyState($: EngineInterface, e: PaneInput) {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column" rowGap="md" borderStyle="dashed" borderColor="subtle" paddingX="md" paddingY="md">
      <Text size="heading" weight="semibold">
        Nothing to babysit yet
      </Text>
      <Text dimColor wrap="wrap">
        No PR yet. The PRs and MRs this session opens or mentions show up here, or follow one by hand above.
      </Text>
      <Box flexDirection="column" rowGap="xs">
        <Text dimColor>◌ CI, approvals and the size of the change</Text>
        <Text dimColor>◌ the threads that wait on you, triaged</Text>
        <Text dimColor>◌ what changed since your last look</Text>
      </Box>
    </Box>
  )
}

export async function drawPane($: EngineInterface, e: PaneInput) {
  const { Box, Input } = $.ui.resolve(e)
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
    <Box flexDirection="column" rowGap="lg" width="100%">
      {slab($, e, {
        gap: 'sm',
        children: [
          <Input key="add" placeholder="Follow a PR: number or URL" submitLabel="add" onSubmit={value => void followByHand($, value)} />,
          shown && switcher($, e, prs, selectedIndex, watches),
        ],
      })}
      {!shown && emptyState($, e)}
      {shown && prView($, e, shown, view, changes, summary)}
    </Box>
  )
}
