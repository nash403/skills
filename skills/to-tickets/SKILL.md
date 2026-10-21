---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured or mentioned tracker.
disable-model-invocation: true
---

Break a plan, spec, or conversation into **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

The issue tracker and vocabulary should have been provided to you. If not, look them up in the project context, then infer them or ask me, then wait for my confirmation.

## Process

### 1. Gather context

Work from what's already in the conversation. If I pass a reference (a spec path, an issue number or URL), fetch it and read its full body and comments.

### 2. Explore the codebase

Unless you already have, explore the code to understand its current state. Use the project's domain glossary vocabulary, and respect the ADRs in the area you're touching.

### 3. Draft vertical slices

- Each slice cuts a narrow but complete path through every layer (schema, API, UI, tests): vertical, never one layer at a time.
- A completed slice is demoable or verifiable on its own.
- Each slice is small enough for an agent to finish in one session.
- Prefactoring comes first: make the change easy, then make the easy change.

Give each ticket its **blocking edges**: the tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors** are the exception: one mechanical change (rename a column, retype a shared symbol) whose blast radius breaks call sites across the codebase, so no vertical slice can land green. Sequence them as expand–contract:

1. **Expand**: add the new form beside the old, so nothing breaks.
2. **Migrate**: move call sites over in batches sized by blast radius (per package, per directory), one ticket per batch, each blocked by the expand. CI stays green because the old form still exists.
3. **Contract**: delete the old form, in a ticket blocked by every batch.
4. If even the batches can't stay green alone, keep the sequence on a shared integration branch, all blocking a final integrate-and-verify ticket. Green is only promised there.

### 4. Quiz me

Present the breakdown as a numbered list, each ticket with its title, what it blocks on, and the end-to-end behaviour it delivers. Ask:

- Does the granularity feel right (too coarse, too fine)?
- Are the blocking edges right: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split?

Iterate until I approve.

### 5. Publish

Publish in dependency order, blockers first, so blocking edges can reference real identifiers. Write each ticket following `ticket-conventions`, its blockers in the related links.

- **Issue tracker** (GitHub, Linear…): one issue per ticket. Use the platform's native blocking and sub-issue relationships where it has them.
- **Local files**: one file per ticket, `<feature-slug>/issues/<NNN>-<slug>.md`, numbered from `001` in dependency order.
