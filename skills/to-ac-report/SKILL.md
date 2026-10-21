---
name: to-ac-report
description: "Reverse-engineer the acceptance criteria of an application view or API endpoint from static analysis, and emit an exhaustive HTML report."
argument-hint: "<view, route, file path, or API endpoint>"
disable-model-invocation: true
---

Photograph what a target surface does **today**, exhaustively, from code and docs, so a migration can decide criterion by criterion what to keep, change or drop. Not a verdict on quality or conformance.

Any repository, any stack: a view and an API endpoint run the same pipeline with adapted vocabulary.

## Hard rules

- **THE AC LIST CAN NEVER BE LONG ENOUGH.** Walk every branch of the decision tree, every DOM element or payload field the consumer receives, every action available under every condition. Continue relentlessly until no unvisited branch remains.
- Static analysis only: code, docs, fixtures, tests, migrations. Never run the app, never browse it.
- Never follow navigation. A link or redirect is one AC stating where it leads; the destination is out of scope.
- Use the repository's domain vocabulary: glossary, docs, i18n catalogs, model and type names. Never invent a term.
- Never drop a branch you could not trace: write the AC, flag the uncertainty in Notes.
- Write the report in the language I ask for, else English, and set `lang` in `report.json` to match; keep domain terms verbatim in their source language.

## Phase 1. Resolve scope (stop gate)

Accept a route, file path, feature name or endpoint URL; locate the root module and every file in scope.

State the root, the in-scope files and the target type (view / endpoint / other), then **stop and wait for approval**.

## Phase 2. Map zones, then fan out

Split the surface into independent zones. View: layout regions and overlays. Endpoint: auth, validation, response shaping, side effects.

Above 3 zones, dispatch one sub-agent per zone; below that, work sequentially, since coordination costs more than it saves.

Sub-agent contract, stated in every prompt:

- Return raw rows only, as JSON criteria `{ text, flags, notes, source }` (see Phase 5), sources as full repo-relative `path:line`.
- No numbering, no headings, no prose. The main agent merges, dedupes cross-cutting AC, orders, numbers, and writes.

## Phase 3. Traverse

**Order.** Follow the order in which the consumer meets the surface.

- *View*: arrival (loading, empty, error, access denied) → zones in reading order → inside a zone, static before interactive, each action followed by its consequences and sub-surfaces → cross-cutting last (keyboard, responsive, persistence, global effects).
- *Endpoint*: auth → input validation → nominal case → variants (filters, pagination, options) → errors → side effects.
- *Neither*: apply the principle and state the chosen order in the report.

**Decision points.** Every `if`, ternary, `&&`, `switch`, early return, guard, conditional render, query state, and permission gate yields at least one AC.

**Resolving possible values.** Follow data only when it drives an observable branch, end to end across layers, and stop as soon as the enumeration is known. Ladder: enums, types and constants → migrations and constraints → fixtures, seeds, factories and tests → business inference.

A database read is a last resort, allowed only when all three hold: the connection is already available, the target is local or explicitly non-production, and the query is a bounded read (`DISTINCT`, `COUNT`, `LIMIT`). Never write.

Any AC resting on inference or on observed data says so in Notes: observed data is a sample, not a rule.

**Sub-surfaces** (tooltip, popover, modal, panel, collapsible). Analyze fully when all three hold: at most 3 user actions, no multi-field validated form, no internal sub-navigation (tabs, steps, pagination). Otherwise one ↗️ row: what it contains in one sentence, what it triggers, and "dedicated analysis required".

## Phase 4. Completeness gate

Mandatory. Re-scan every in-scope file for decision points; each must map to at least one AC. Anything unmapped goes back through Phase 3. Loop until a full pass adds nothing.

## Phase 5. Report

Write only the data, as `report.json` in the OS temporary directory, then render it from the analysed repository's root:

`node <skill-dir>/build.mjs <tmp>/report.json <out.html>`

The output goes to the OS temporary directory as `state-of-ac-<target-slug>-<YYYY-MM-DD>.html`, or to the path the user specified. `build.mjs` numbers the IDs (`<zone code>-NN`), counts, escapes, inlines the stylesheet and rejects a missing field, an unknown flag, or a source file or line that doesn't exist. Fix what it reports and rerun it. Never edit the HTML.

```json
{
  "lang": "en",
  "target": { "name": "Checkout", "path": "src/pages/checkout/index.tsx", "description": "…" },
  "filesRead": 14,
  "access": [{ "path": "…", "prerequisites": "…", "note": "…" }],
  "features": ["…"],
  "zones": [
    { "code": "PAY", "name": "Payment", "criteria": [
      { "text": "…", "flags": ["🔒"], "notes": "…", "source": "src/pages/checkout/Payment.tsx:42" }
    ]}
  ]
}
```

- **`target.description`**: two or three sentences on the surface itself, for a reader who has never seen it: what it is for, who lands on it, what they do there. Never the analysis, its method, its exhaustiveness or the report's purpose.
- **`access`**: one entry per menu entry, inbound link, deep link and redirect. Prerequisites cover role, permission, feature flag and required data state.
- **`features`**: a macro list of what the surface offers. The section only shows with two or more.
- **`zones`**: in Phase 3 order, each with a short uppercase `code` for its IDs.
- **Criterion**: `text` is a dense declarative sentence, never Given/When/Then. `flags` holds 0..n of the flags below, empty by default. `notes` is very succinct: the implicit rule, the uncertainty, the inference. `source` is the full repo-relative `path:line`: resolve every abbreviated path against the repo.

Text fields are plain text; wrap code in backticks. The template adds the legend, the usage tips and the zone index by itself.

| Flag | Meaning |
| --- | --- |
| 💅 | Purely informational, the consumer reads it and takes no action on it |
| 🤫 | Implicit rule, not displayed and not explained anywhere in the interface |
| 🔒 | Gated by role, permission, or feature flag |
| ⚠️ | Destructive or irreversible action |
| 👻 | Dead, unreachable, or inconsistent branch |
| ↗️ | Leads elsewhere, destination or sub-surface deliberately not analyzed |
| 🔧 | Off-screen only, no visible outcome: a request, a cache write, a side effect |
| 📊 | Emits telemetry or a log worth watching |
| 🔀 | The responsive threshold itself, the point where the layout switches. Never for behavior that merely happens on one breakpoint |

Close with one chat line: the file path, then the counts `build.mjs` prints (AC total, zones, per-flag breakdown).
