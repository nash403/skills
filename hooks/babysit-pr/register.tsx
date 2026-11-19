import type { EngineInterface, Register, TurnCompleteInput } from 'claude-code'

import { followCommandPrs, followSessionPrs, hasOptedIn, optIn, refreshOpenPrs } from './followed'
import { drawPane } from './pane'
import { TRIAGE_TOOL_SPEC } from './triage'
import { saveTriage } from './triaged'

const PANE_ID = 'babysit-pr'
// triage.ts's TRIAGE_TOOL, spelled out: validate reads an imported matcher value as `?`.
const TRIAGE_TOOL = 'mcp__nash403-skills__babysit_pr_triage'
const POLL_EVERY_MS = 3 * 60_000
const PLATFORM_COMMAND = /\b(gh|glab)\s|\bgit\s(?:[^;&|\n]*\s)?push\b/

async function isPaneOpen($: EngineInterface) {
  return (await $.ui.panes()).some(pane => pane.id === PANE_ID)
}

// Work started from an event and not awaited: a failure goes to the debug log instead of an unhandled rejection.
function inBackground($: EngineInterface, task: string, work: Promise<void>) {
  work.catch(error => $.ui.log(`babysit-pr: ${task} failed: ${String(error)}`, { to: 'debug' }))
}

function triageToolFailed($: EngineInterface, error: unknown) {
  $.ui.log(`babysit-pr: the triage tool failed: ${String(error)}`, { to: 'debug' })

  return { deny: 'The /babysit-pr pane could not record the triage.' }
}

async function catchUp($: EngineInterface) {
  await followSessionPrs($)
  await refreshOpenPrs($)
}

async function afterTurn($: EngineInterface) {
  if (await hasOptedIn($)) {
    await catchUp($)
  }
}

// Polls only while the pane is open.
async function poll($: EngineInterface) {
  if ((await hasOptedIn($)) && (await isPaneOpen($))) {
    await refreshOpenPrs($)
  }
}

async function afterCommand($: EngineInterface, command: string, output: string) {
  if (!PLATFORM_COMMAND.test(command) || !(await hasOptedIn($))) {
    return
  }

  await followCommandPrs($, command, output)
  await refreshOpenPrs($)
}

// Both streams: git prints a push's remote messages, an MR link among them, on stderr.
function bashOutput(response: unknown) {
  const { stdout, stderr } = (response ?? {}) as { stdout?: unknown; stderr?: unknown }

  return [stdout, stderr].filter(stream => typeof stream === 'string').join('\n')
}

// Only once /babysit-pr has run: the tool's schema sits in every prompt of the session.
async function registerTriageTool($: EngineInterface) {
  await $.tool.register(TRIAGE_TOOL_SPEC)
}

export async function startBabysitPr($: EngineInterface) {
  await $.command.register({ name: 'babysit-pr', description: 'Follow the PRs and MRs of this session in a pane' })

  if (await hasOptedIn($)) {
    await registerTriageTool($)
  }

  $.clock.every(POLL_EVERY_MS, () => inBackground($, 'poll', poll($)))
}

// Subagent turns don't refresh: the main turn that waits on them does.
export function catchUpBabysitPrAfterTurn($: EngineInterface, e: TurnCompleteInput) {
  if (e.agentId === undefined) {
    inBackground($, 'catch-up', afterTurn($))
  }
}

export const register: Register = on => {
  on('command.run', { command: 'babysit-pr' }, async $ => {
    await optIn($)
    await registerTriageTool($)
    const opened = await $.ui.open({ id: PANE_ID, title: 'PRs' })
    inBackground($, 'catch-up', catchUp($))

    return { text: opened.isPlaced ? 'PR pane opened.' : `The PR pane could not open: ${opened.reason}.` }
  })

  on('classic.PostToolUse', { tool_name: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    const { command } = (e.tool_input ?? {}) as { command?: unknown }

    if (typeof command === 'string') {
      inBackground($, 'refresh after a command', afterCommand($, command, bashOutput(e.tool_response)))
    }

    return result
  })

  // Served ahead of the permission check: it only writes to the pane, so asking each time would be noise.
  on('tool.call', { tool: TRIAGE_TOOL }, async ($, e) => saveTriage($, e)).catch(($, _, next) => triageToolFailed($, next.error))

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => drawPane($, e))
}
