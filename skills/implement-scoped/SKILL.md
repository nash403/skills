---
name: implement-scoped
description: "Scope requested work to fit one agent session, build what fits, finish the mechanical leftovers with sub-agents, and hand off the rest. Use when a request's size is unclear or likely too big for one session."
disable-model-invocation: true
---

Scope the work to fit one session, build what fits with the usual implementation workflow (`implementation-loop`), and hand off the rest.

## 1. Gather

Dispatch a sub-agent to gather the facts, so the main context stays light for the build: the request, the ticket (from the prompt or the branch), and the codebase surface (Glob → Grep → Read only matches). It returns the files involved and the size signals below, not their content. Never ask what can be looked up.

## 2. Grill the gaps

Only if the facts leave the size undetermined, using `grilling` for the mechanism. Ask only what moves the estimate: capability count, back and/or front, new model or migration, impacted surfaces, what is explicitly out. UX detail and edge cases belong to the build.

## 3. Size

Judge, no threshold. High-weight signals: ≥2 distinct capabilities, backend plus frontend, new model, migration or schema, new external integration. Medium: new route or page, ≥3 files across ≥2 packages.

Anchors: **L** = model, migration, endpoints, UI. **M** = multi-file frontend with backend wiring. **S** = one surface, existing plumbing.

**At L or above, propose at least one fast path or defer.**

## 4. Fast paths and defers

Prefer a cheaper way to deliver the request over cutting it. Valid only when reversal is mechanical, needing no design-system or domain knowledge to finish later.

- **Defer**: capability leaves the session, stays visible as deferred (disabled control plus tooltip, banner). Never an enabled control that does nothing.
- **Cheap mechanics**: capability works, built cheaply. Raw strings over i18n keys, mocked data in a schema-compatible shape, placeholder loading, error and empty states.
- **Never**: native elements over the project's components, hand-rolled date manipulation or formatting when the project already offers them, hardcoded colors, skipped auth checks.

## 5. Gate

Cutting a capability is my call. When the scope defers one, present ≤15 lines: scope (one sentence per capability), 2-4 acceptance criteria, defers and fast paths with a one-line rationale each, out of scope, assumptions. Wait for an explicit go. I may amend the tradeoffs: apply and re-present once. A second round, or a shifted scope, means re-grilling.

Without a defer, state the scope and the fast paths in a few lines and go straight to the build.

## 6. Build

Build the approved scope only, following `implementation-loop` up to its review. Capabilities surfacing mid-build are defers.

## 7. Finish

Once the build passes its checks, take the fast paths that can be reversed now: mechanical, and nothing they need is missing (mocks stay mocks until the real API exists). Dispatch sub-agents to reverse them, one per set of files no other touches: usually a single one, since such fixes often share a file (a translations file). Brief each with the exact items, their files and how each reverses, and have it keep the checks green. A fix that fails, or turns out to need a decision, goes back to the handoff.

Then finish `implementation-loop` on the whole change, build and finishing together: review, then commit as it says.

## 8. Close and hand off

Restate what was deferred and why, then `handoff` the remainder:

- One handoff per substantial defer, the capability as argument.
- One shared handoff for small defers and the fast paths still in place, each listed with what reverses it (raw strings to i18n keys, mocks to real data, placeholder states to final ones).

List the handoff paths in the close.
