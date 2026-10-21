---
name: ticket-conventions
description: Conventions for writing tickets in PM's voice. Ticket = any tracked work item (issue, story, bug, task, epic, spec). Use when I ask to draft, write, create, or convert a request into one, or to reword, reformat, or clean up an existing one.
---

Write as the PM/PO who owns the need: decisive, plain, English, no hedging, lists over
prose, zero filler ("it's worth noting", "going forward"). State the easy-to-miss obvious —
default state of new UI, persistence, disabled/loading/empty states, what each button does.

Destination given (a template in the prompt, a ticket-creation skill, or the existing
ticket): read its sections, drop each dimension below into the matching one, change only
section content — keep every block and heading — and let that skill own page creation,
properties, and template application. Rewording is patching, never rewriting: retone the
sections that miss my intent, leave the sound ones untouched. No destination: emit one
paste-ready plain-Markdown block — no @-mentions, callouts, toggles, `<details>`.

## Sections

In order. Physically delete a section that adds nothing — no empty heading, no "N/A", no
"see above".

1. **Title** — one line. For stories, add As a … I want … so that …
2. **Why this matters** — current pain + value, 2–4 bullets.
3. **What to build** — the flow from entry point to end state in user-visible language, plus
   the rules that govern it: first-render defaults, sync/persistence, locked states,
   validation thresholds, empty/loading states, warn-vs-hard-block. Decisions carry their
   rationale ("non-blocking warning in v1, hard block deferred"). Reference mockups inline.
   Tag each rule `[BR1]`, `[BR2]`, …
4. **Acceptance criteria** — checkboxes, one dense declarative sentence each, independently
   verifiable. Terse, no rationale, no paraphrase of 3. Tag
   `[AC1]`, `[AC2]`, … e.g. `- [ ] [AC1] Revoking access logs the actor and the timestamp.`
5. **Blocked by & Related tickets / links** *(conditional)* — blockers first, then existing
   parents, siblings, design files, specs. Never the ticket's own sub-tasks.

No "Out of scope" section: it pollutes the read and hands the reader — human or agent —
context it then has to ignore.

Rules and criteria alike: avoid specific file paths or code snippets, they go stale fast.
Exception: if a prototype produced a snippet that encodes a decision more precisely than
prose can (state machine, reducer, schema, type shape), inline it and note briefly that it
came from a prototype. Trim to the decision-rich parts — not a working demo, just the
important bits.

Anything explicitly deferred becomes `Placeholder for <what's missing>` — one line, no
owner, no timing. Any user-facing copy in the demand ships translated into every language
the product serves (detect the project's language set; ask once if it isn't obvious), each
phrasing judged in context — never a blank locale.

## Before delivering

- [ ] Acceptance criteria are testable observations, not a paraphrase of the rules in 3.
- [ ] No two sections say the same thing.
- [ ] Every empty conditional section is physically gone.
- [ ] No file paths, no unjustified snippet, no filler phrase.
