import type { EngineInterface, Register, TurnCompleteInput } from 'claude-code'

import { saveReplyDraft } from './drafted'
import { REPLY_DRAFT_TOOL_SPEC } from './drafts'
import { clearShownPrChanges, followCommandPrs, followSessionPrs, hasOptedIn, markPrOnScreenShown, optIn, refreshOpenPrs } from './followed'
import { drawPane } from './pane'
import { TRIAGE_TOOL_SPEC } from './triage'
import { saveTriage } from './triaged'

// followed.ts's PANE_ID, triage.ts's TRIAGE_TOOL and drafts.ts's REPLY_DRAFT_TOOL, spelled out: validate reads an imported matcher value as `?`.
const PANE_ID = 'babysit-pr'
const TRIAGE_TOOL = 'mcp__nash403-skills__babysit_pr_triage'
const REPLY_DRAFT_TOOL = 'mcp__nash403-skills__babysit_pr_draft_reply'
const POLL_EVERY_MS = 3 * 60_000
const PLATFORM_COMMAND = /\b(gh|glab)\s|\bgit\s(?:[^;&|\n]*\s)?push\b/

// Work started from an event and not awaited: a failure goes to the debug log instead of an unhandled rejection.
function inBackground($: EngineInterface, task: string, work: Promise<void>) {
  work.catch(error => $.ui.log(`babysit-pr: ${task} failed: ${String(error)}`, { to: 'debug' }))
}

// `what` is what the tool records: the triage, the draft reply.
function paneToolFailed($: EngineInterface, what: string, error: unknown) {
  $.ui.log(`babysit-pr: recording ${what} failed: ${String(error)}`, { to: 'debug' })

  return { deny: `The /babysit-pr pane could not record ${what}.` }
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

// Polls with the pane closed too. A pane found shown counts as showing its PR.
async function poll($: EngineInterface) {
  if (!(await hasOptedIn($))) {
    return
  }

  await markPrOnScreenShown($)
  await refreshOpenPrs($)
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

// Only once /babysit-pr has run: the tools' schemas sit in every prompt of the session.
async function registerPaneTools($: EngineInterface) {
  await $.tool.register(TRIAGE_TOOL_SPEC)
  await $.tool.register(REPLY_DRAFT_TOOL_SPEC)
}

export async function startBabysitPr($: EngineInterface) {
  await $.command.register({ name: 'babysit-pr', description: 'Follow the PRs and MRs of this session in a pane' })

  if (await hasOptedIn($)) {
    await registerPaneTools($)
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
    await registerPaneTools($)
    const opened = await $.ui.open({ id: PANE_ID, title: 'PRs' })
    await markPrOnScreenShown($)
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

  // Both served ahead of the permission check: they only write to the pane, so asking each time would be noise.
  on('tool.call', { tool: TRIAGE_TOOL }, async ($, e) => saveTriage($, e)).catch(($, _, next) => paneToolFailed($, 'the triage', next.error))
  on('tool.call', { tool: REPLY_DRAFT_TOOL }, async ($, e) => saveReplyDraft($, e)).catch(($, _, next) => paneToolFailed($, 'the draft reply', next.error))

  // Before the button's own handler, which may switch to another PR.
  on('ui.press', { component: 'Pane', requestId: PANE_ID }, async ($, e, next) => {
    await clearShownPrChanges($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => drawPane($, e))
}
