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

// What a chip's icon is: drawn as an Svg where the surface has one, as its glyph on the terminal.
export type IconName = 'check' | 'cross' | 'clock' | 'dashed' | 'warning' | 'half' | 'ban' | 'skip' | 'diamond' | 'up' | 'pencil' | 'circle'

export const GLYPHS: Record<IconName, string> = {
  check: '✓',
  cross: '✕',
  clock: '◷',
  dashed: '◌',
  warning: '⚠',
  half: '◐',
  ban: '⊘',
  skip: '↷',
  diamond: '◆',
  up: '↑',
  pencil: '✎',
  circle: '○',
}

// Each icon on a 16-unit grid: strokes in `S`, fills in `F`, both swapped for the color it is drawn in.
const ICON_PATHS: Record<IconName, string> = {
  check: '<path d="M3.5 8.5l3 3 6-7" stroke="S"/>',
  cross: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="S"/>',
  clock: '<circle cx="8" cy="8" r="6" stroke="S"/><path d="M8 4.8V8l2.2 1.6" stroke="S"/>',
  dashed: '<circle cx="8" cy="8" r="6" stroke="S" stroke-dasharray="2.4 2.4"/>',
  warning: '<path d="M8 2.2l6.3 11.1H1.7z" stroke="S"/><path d="M8 6.5v3" stroke="S"/><circle cx="8" cy="11.4" r=".6" fill="F"/>',
  half: '<circle cx="8" cy="8" r="6" stroke="S"/><path d="M8 2a6 6 0 0 1 0 12z" fill="F"/>',
  ban: '<circle cx="8" cy="8" r="6" stroke="S"/><path d="M3.8 12.2l8.4-8.4" stroke="S"/>',
  skip: '<path d="M3 11.5a5 5 0 0 1 9.4-2.4" stroke="S"/><path d="M12.8 4.6v4.2H8.6" stroke="S"/>',
  diamond: '<path d="M8 2l6 6-6 6-6-6z" fill="F"/>',
  up: '<path d="M8 13V3M4 7l4-4 4 4" stroke="S"/>',
  pencil: '<path d="M10.5 2.5l3 3L6 13H3v-3z" stroke="S"/>',
  circle: '<circle cx="8" cy="8" r="5.5" stroke="S"/>',
}

export function iconSvg(icon: IconName, color: string, size: number) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`,
    ICON_PATHS[icon].replace(/"[SF]"/g, `"${color}"`),
    '</svg>',
  ].join('')
}

export type Look = { tone: Tone; icon: IconName }

export const STATUS_LOOKS: Record<StatusChip, Look> = {
  merged: { tone: TONES.plum, icon: 'diamond' },
  closed: { tone: TONES.slate, icon: 'cross' },
  approved: { tone: TONES.moss, icon: 'check' },
  'approved + threads': { tone: TONES.moss, icon: 'check' },
  updated: { tone: TONES.cobalt, icon: 'up' },
  reviewed: { tone: TONES.saffron, icon: 'pencil' },
  resolved: { tone: TONES.moss, icon: 'check' },
  opened: { tone: TONES.slate, icon: 'circle' },
}

export const CI_LOOKS: Record<Exclude<CiState, 'none'>, Look & { text: string }> = {
  starting: { text: 'CI starting', tone: TONES.slate, icon: 'dashed' },
  pending: { text: 'CI pending', tone: TONES.saffron, icon: 'clock' },
  ok: { text: 'CI ok', tone: TONES.moss, icon: 'check' },
  error: { text: 'CI error', tone: TONES.signal, icon: 'cross' },
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

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, char => `&#${char.charCodeAt(0)};`)
}

// A filled disc with the letters centered: an avatar exactly as tall as a line of text, no padding around it.
export function avatarSvg(letters: string, tone: Tone, size: number) {
  const fontSize = letters.length > 1 ? 8.5 : 11

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20">`,
    `<circle cx="10" cy="10" r="10" fill="${tone.bg}"/>`,
    `<text x="10" y="10" dy=".35em" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="600" fill="${tone.fg}">${escapeXml(letters)}</text>`,
    '</svg>',
  ].join('')
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

// Two speech bubbles, the front one checked: no open thread. Gray strokes at partial opacity read on either theme.
export function settledThreadsSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="32" viewBox="0 0 44 32" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">',
    `<path d="M14 8a2 2 0 0 1 2-2h20a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-2v4l-5-4h-1" stroke="${TONES.slate.bg}" stroke-opacity=".45"/>`,
    `<path d="M4 12a4 4 0 0 1 4-4h18a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H13l-5 4v-4a4 4 0 0 1-4-4z" stroke="${TONES.slate.bg}" fill="${TONES.slate.bg}" fill-opacity=".1"/>`,
    `<path d="M12 16.5l3 3 6-6" stroke="${TONES.moss.bg}" stroke-width="2"/>`,
    '</svg>',
  ].join('')
}
