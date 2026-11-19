import type { CiState, TriageImportance } from '../../types'
import type { StatusChip } from './rules'

// A chip carries its own background and text color, so it reads the same on a light or a dark theme.
export type Tone = { bg: string; fg: string }

const LIGHT_INK = '#FFFFFF'
const DARK_INK = '#1B1B1F'

export const TONES = {
  moss: { bg: '#2F8F5B', fg: LIGHT_INK },
  saffron: { bg: '#E5A50A', fg: DARK_INK },
  cobalt: { bg: '#3D6FE0', fg: LIGHT_INK },
  slate: { bg: '#6E7781', fg: LIGHT_INK },
  plum: { bg: '#8B54D6', fg: LIGHT_INK },
  signal: { bg: '#D6404E', fg: LIGHT_INK },
  // The user's move: the one color nothing else in the pane uses.
  fuchsia: { bg: '#D63384', fg: LIGHT_INK },
} satisfies Record<string, Tone>

export const STATUS_LOOKS: Record<StatusChip, { tone: Tone; glyph: string }> = {
  merged: { tone: TONES.plum, glyph: '◆' },
  closed: { tone: TONES.slate, glyph: '×' },
  approved: { tone: TONES.moss, glyph: '✓' },
  'approved + threads': { tone: TONES.moss, glyph: '✓' },
  updated: { tone: TONES.cobalt, glyph: '↑' },
  reviewed: { tone: TONES.saffron, glyph: '✎' },
  resolved: { tone: TONES.moss, glyph: '✓' },
  opened: { tone: TONES.slate, glyph: '○' },
}

export const CI_LOOKS: Record<Exclude<CiState, 'none'>, { text: string; tone: Tone }> = {
  starting: { text: 'CI starting', tone: TONES.slate },
  pending: { text: 'CI pending', tone: TONES.saffron },
  ok: { text: 'CI ok', tone: TONES.moss },
  error: { text: 'CI error', tone: TONES.signal },
}

export const IMPORTANCE_TONES: Record<TriageImportance, Tone> = { high: TONES.signal, medium: TONES.saffron, low: TONES.slate }

const AVATAR_COLORS = ['#3D6FE0', '#2F8F5B', '#8B54D6', '#0F766E', '#B4469B', '#5B6CE0', '#9D4E15', '#4A7A1E']
const MAX_NAME = 18

// `coderabbitai[bot]` on GitHub, `project_123_bot_5f2e…` or `group_9_bot_…` on GitLab.
export function isBot(name: string) {
  return /\[bot\]$/.test(name) || /(^|_)bot(_|$)/.test(name)
}

export function displayName(name: string) {
  const bare = name.replace(/\[bot\]$/, '')

  return bare.length > MAX_NAME ? `${bare.slice(0, MAX_NAME - 1)}…` : bare
}

export function initials(name: string) {
  const parts = name.replace(/\[bot\]$/, '').split(/[-_.\s]+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : name.slice(0, 2)

  return letters.toUpperCase()
}

// The same person gets the same color everywhere in the pane.
export function avatarTone(name: string): Tone {
  let hash = 0

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return { bg: AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? TONES.slate.bg, fg: LIGHT_INK }
}

const DIFF_BLOCKS = 5

// GitHub's five-block diffstat: added and removed shares of the changed lines, at least one block for each side
// that has lines, the gray rest when nothing changed.
export function diffBlocks(additions: number, deletions: number) {
  const total = additions + deletions

  if (total === 0) {
    return { added: 0, removed: 0, neutral: DIFF_BLOCKS }
  }

  const share = Math.round((DIFF_BLOCKS * additions) / total)
  const added = Math.min(Math.max(share, additions > 0 ? 1 : 0), deletions > 0 ? DIFF_BLOCKS - 1 : DIFF_BLOCKS)

  return { added, removed: DIFF_BLOCKS - added, neutral: 0 }
}

// The same shares as a rounded bar, for the surfaces that draw an Svg.
export function diffBarSvg(additions: number, deletions: number, width: number, height: number) {
  const total = additions + deletions
  const added = total === 0 ? 0 : Math.round((width * additions) / total)
  const rest = total === 0 ? TONES.slate.bg : TONES.signal.bg

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<clipPath id="pill"><rect width="${width}" height="${height}" rx="${height / 2}"/></clipPath>`,
    `<g clip-path="url(#pill)"><rect width="${width}" height="${height}" fill="${rest}"/>`,
    `<rect width="${added}" height="${height}" fill="${TONES.moss.bg}"/></g></svg>`,
  ].join('')
}
