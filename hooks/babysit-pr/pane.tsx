import type { Color, EngineInterface, RenderInput } from 'claude-code'

import type { CiState, FollowedPr, PrSnapshot } from '../../types'
import { followByHand, readFollowedPrs, refreshPr, select, unfollow } from './followed'
import { prLabel } from './refs'
import { isPushedSinceApproval, isSkipCi, participants, statusChip, threadCounts } from './rules'
import type { StatusChip } from './rules'

type PaneInput = RenderInput<'Pane'>

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

const CI_TEXTS: Record<CiState, { text: string; color: Color }> = {
  none: { text: 'no CI', color: 'inactive' },
  starting: { text: 'CI starting', color: 'warning' },
  pending: { text: 'CI pending', color: 'warning' },
  ok: { text: 'CI ok', color: 'success' },
  error: { text: 'CI error', color: 'error' },
}

function switcher($: EngineInterface, e: PaneInput, prs: readonly FollowedPr[], index: number) {
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const shown = prs[index]

  if (!shown) {
    return null
  }

  const previous = prs[(index - 1 + prs.length) % prs.length] ?? shown
  const next = prs[(index + 1) % prs.length] ?? shown
  const url = shown.snapshot?.url
  const hasMany = prs.length > 1

  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} width="100%">
      {hasMany && <Button key="previous" label="‹" plain onPress={() => void select($, previous.ref)} />}
      {hasMany && (
        <Text dimColor>
          {index + 1}/{prs.length}
        </Text>
      )}
      {hasMany && <Button key="next" label="›" plain onPress={() => void select($, next.ref)} />}
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

function prView($: EngineInterface, e: PaneInput, followed: FollowedPr) {
  const { Box, Text } = $.ui.resolve(e)
  const pr = followed.snapshot

  return (
    <Box flexDirection="column" rowGap={1}>
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
      {pr && countsLine($, e, pr)}
      {pr && participantRows($, e, pr)}
    </Box>
  )
}

// A minimized pane on the desktop app: one line, and clicks may not reach it.
function glance($: EngineInterface, e: PaneInput, followed: FollowedPr | undefined) {
  const { Text } = $.ui.resolve(e)

  if (!followed?.snapshot) {
    return <Text dimColor>{followed ? prLabel(followed.ref) : 'No PR'}</Text>
  }

  const chip = statusChip(followed.snapshot)

  return (
    <Text>
      {prLabel(followed.ref)} <Text color={CHIP_COLORS[chip]}>{chip}</Text>
    </Text>
  )
}

export async function drawPane($: EngineInterface, e: PaneInput) {
  const { Box, Input, Text } = $.ui.resolve(e)
  const { prs, selectedIndex } = await readFollowedPrs($)
  const shown = prs[selectedIndex]

  if (e.props.placement === 'widget') {
    return glance($, e, shown)
  }

  return (
    <Box flexDirection="column" rowGap={1} width="100%">
      {shown ? switcher($, e, prs, selectedIndex) : <Text dimColor>No PR yet. The PRs and MRs this session opens or mentions show up here.</Text>}
      {shown && prView($, e, shown)}
      <Input key="add" placeholder="Add a PR: number or URL" submitLabel="add" onSubmit={value => void followByHand($, value)} />
    </Box>
  )
}
