import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PrRef } from '../../types'
import { findFollowedPr } from './followed'
import { parsePrUrl, prKey, prLabel } from './refs'
import { parseTriageInput, recordTriage } from './triage'
import { threadsLabel } from './turns'

// The triage the model recorded through its tool, by PR key then thread id. It outlives a refresh of the PR.
const triages = atom({ plugin: 'nash403-skills', key: 'babysitTriages' } as const, {}, { shape: 'triages-1' })

// Read while drawing, this subscribes the drawing to the triage.
export async function readPrTriage($: EngineInterface, ref: PrRef) {
  return (await read($, triages))[prKey(ref)] ?? {}
}

export async function saveTriage($: EngineInterface, input: unknown): Promise<{ result: string } | { deny: string }> {
  const parsed = parseTriageInput(input)

  if ('errors' in parsed) {
    return { deny: parsed.errors.join('\n') }
  }

  const ref = parsePrUrl(parsed.prUrl)
  const snapshot = ref ? (await findFollowedPr($, ref))?.snapshot : null

  if (!ref || !snapshot) {
    return { deny: `${parsed.prUrl} is not a PR the /babysit-pr pane follows, or it has not loaded yet.` }
  }

  const key = prKey(ref)
  const recorded = recordTriage((await read($, triages))[key] ?? {}, snapshot, parsed.entries)

  if ('errors' in recorded) {
    return { deny: recorded.errors.join('\n') }
  }

  const savedCount = parsed.entries.length - recorded.skipped.length

  if (savedCount === 0) {
    return { deny: `None of these threads is on ${prLabel(ref)}: ${recorded.skipped.join(', ')}.` }
  }

  await update($, triages, all => ({ ...all, [key]: recorded.triage }))
  const skipped = recorded.skipped.length > 0 ? ` Skipped ${recorded.skipped.join(', ')}: not threads of this PR.` : ''

  return { result: `Recorded the triage of ${threadsLabel(savedCount)} on ${prLabel(ref)}. The /babysit-pr pane shows it.${skipped}` }
}
