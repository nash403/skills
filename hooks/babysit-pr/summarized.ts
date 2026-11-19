import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { PrRef, PrSnapshot, PrSummary } from '../../types'
import { prKey } from './refs'
import { SUMMARY_SYSTEM, cleanSummary, descriptionSummary, summaryPrompt, summarySource } from './summary'

const summaries = atom({ plugin: 'nash403-skills', key: 'babysitSummaries' } as const, {}, { shape: 'summaries-1' })

const writing = new Set<string>()

// Read while drawing, this subscribes the drawing to the summaries.
export async function readPrSummary($: EngineInterface, ref: PrRef): Promise<PrSummary | undefined> {
  return (await read($, summaries))[prKey(ref)]
}

async function store($: EngineInterface, key: string, summary: PrSummary) {
  await update($, summaries, all => ({ ...all, [key]: summary }))
}

// One model call per PR, again only when its title or description changes. The description's first sentences
// show meanwhile, and stay when the model gives no text.
export async function summarize($: EngineInterface, ref: PrRef, pr: PrSnapshot) {
  const key = prKey(ref)
  const source = summarySource(pr)
  const stored = (await read($, summaries))[key]

  if (stored?.source === source || writing.has(key)) {
    return
  }

  await store($, key, { source, text: descriptionSummary(pr.description), by: 'description' })

  if (pr.description.trim() === '') {
    return
  }

  writing.add(key)

  try {
    const answer = await $.model.complete({ model: 'haiku', system: SUMMARY_SYSTEM, prompt: summaryPrompt(pr), maxTokens: 220 })
    const text = answer.isAnswered ? cleanSummary(answer.text) : ''

    if (text !== '') {
      await store($, key, { source, text, by: 'model' })
    }
  } finally {
    writing.delete(key)
  }
}
