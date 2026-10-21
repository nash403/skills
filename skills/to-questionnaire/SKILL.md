---
name: to-questionnaire
description: Turn a decision you can't fully answer into a questionnaire for someone else to fill in.
disable-model-invocation: true
---

Turn something I can't answer alone into a **questionnaire**: a Markdown document I hand to one person to fill in async, or fill out together over a meeting. The recipient holds the knowledge I lack; the questionnaire pulls it out of them.

**Grill the send, not the subject.** Interview me only about the _send_, which I can always answer.

1. **Who is it going to?** One exchange: the recipient's role, expertise, relationship to me. Done when you know what they know that I don't.
2. **What do you need back?** One exchange: the decisions or facts I can't resolve alone. Done when you have a concrete list of what I must walk away able to decide.
3. **Write it** as `to-questionnaire-<slug>.md` (slug from the topic) and tell me where you saved it. Ask only what the recipient knows and I need, until every item from step 2 is covered.

Pitch the questions at the recipient: their vocabulary, the product as they know it, no internals or code unless they're technical. Language: the one I ask for, else the recipient's, else English.

## Document structure

A discovery questionnaire: I lack context, the recipient holds it. Most important first: async may give you one pass only. Group under `##` themes past a handful of questions.

<questionnaire-template>

# <Questionnaire title>

**Purpose:** why this questionnaire exists and the decision riding on it.

**From:** <me>, **To:** <the recipient>, **How your answers will be used:** <where they go>

## Context

One paragraph orienting a recipient who wasn't in my head.

## How to answer

Partial answers and "I don't know" are useful: flag anything you're unsure of rather than skipping it.

## <Theme heading>

Its questions, most-important-first. One idea each, never compound, with an answer stub directly beneath, and a one-line _why this matters_ only where the question could be misread or invite a throwaway answer.

<question-example>
### What load is the system expected to handle at launch?

_Why this matters: it decides whether we provision for burst traffic now or defer it._

>
</question-example>

## Anything else?

Anything we didn't ask that we should know?

</questionnaire-template>
