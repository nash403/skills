---
name: iterate-feature
description: "Build a feature iteration by iteration: each one ships one capability I can test, takes shortcuts it tracks, and narrows toward production quality, with an artifact per iteration that carries the state between sessions. Use when I start or continue an iteration of a feature."
argument-hint: "The feature, and what this iteration should do"
---

Build the feature one iteration at a time. Each iteration ships one capability I can test end to end, real from request to visible result. Unclear points don't block: pick the most reasonable fast path, build, track it. The feature narrows toward production quality because shortcuts get resolved faster than new ones get taken.

Build with the usual workflow (`implementation-loop`); this skill owns the funnel around it.

## Signal

Until the session ends, start every response with a random emoji and a random made-up past-tense word, never the same as the previous response: `🦔 Razzled.`

Emojis: 🐠 🫘 🐇 🦔 🎲 🪵 🧊 🌵 🗿 🪬 🧲 🪭 🐼 🦩 🔭 🧪 🪜 🌋 🪇 🪶

Words: Razzled, Fuzzled, Noodled, Percolated, Schlepped, Finagled, Bamboozled, Combobulated, Spelunked, Hornswoggled, Moseyed, Wrangled, Kerfuffled, Flummoxed, Doodled, Simmered, Gallivanted, Skedaddled, Befuddled, Tinkered.

## Feedback is not a build order

Feedback on a tested iteration, observations, "ok", "noted" or silence never trigger code: record them in the artifact (see Feedback) and ask whether to build. Only an explicit order ("go", "vas-y", "next iteration", "fix it") starts a build. A build order that adds a new capability to an open iteration re-runs the sizing; failing it, it's the next iteration. In doubt, record and ask.

## Start

Artifacts live in my personal context folder, under `features/<slug>/NNN-<slug>.md` (`001-supplier-price-history.md`). Pick the slug yourself at iteration 1, and create the folders on the first write. If I have no personal context folder, suggest running `setup-personal-context` first.

- **New feature** (no folder matches what I describe): go to Grill and scope section.
- **Existing feature**: read its latest artifact and the Original request of `001`. Then dispatch a sub-agent, so the main context stays light for the build. It checks the artifact still matches the code (files exist, claimed behaviour is there), lists the commits since the last iteration's `from_ref` that aren't that iteration's work, and maps the surface the new request touches. It returns findings, files and size signals, not file contents.
- **Recap** in a few lines: the goal, what the last iteration changed, the ▶ items, and any work done outside the iterations. Warn if the checkout isn't the artifact's `branch`. No feedback recorded on the last iteration: ask whether it was tested.

## Grill and scope

Grill every iteration with `grilling`, stopping once the keystone is chosen and sized; iteration 2+ opens with what the last build and my feedback taught. Every finding gets a destination at once: in the slice, a fast path, a to-do item if it's in the agreed scope, an open question otherwise. The grill sharpens the keystone, it never adds a second capability.

**Size.** Two or more capabilities: pick the keystone, the one the others depend on or the one proving the most uncertain assumption; the rest become to-do items. Small items ride along when they share files and tests. Most observable value or most removed uncertainty ships first. The iteration fits one session (grill, build, review, artifact), or it's two.

**Removing existing behaviour.** If old and new can coexist coherently, ship the new in parallel and demolish in a later iteration. If not (contradicting payloads, two edit paths with diverging validation, the old being the only recovery), demolish now with non-regression tests, or keep the old as a bridge, recorded as a fast path.

**Go.** Present in at most 15 lines: the keystone as "I can <action> and see <result>", 2-4 acceptance criteria I'll test, the fast paths with a one-line reason, what's out, assumptions. The app still runs and the checks pass after it. Wait for go; on go, record `git rev-parse HEAD` as `from_ref`.

## Build

Follow `implementation-loop`. Reuse what exists before writing; inline something only as a fast path, with a to-do item to extract it.

**Fast paths** are valid only when reversing them is mechanical, needing no design-system or domain knowledge:

- **Defer**: the capability is missing this iteration and visible as deferred (disabled control with a tooltip, banner, honest confirmation), never an enabled control that does nothing or a success message that lies. Mark its spot with `FIXME(<slug>):`.
- **Cheap mechanics**: the capability works, built cheaply: raw strings over i18n keys, mocked data in a schema-compatible shape, placeholder loading, error and empty states, rough layout.
- **Never**: native elements over the project's components, hand-rolled domain formatting (money, dates, units, statuses) over the project's utilities, hardcoded colors, skipped auth or permission checks.

Every fast path becomes a to-do item saying what replaces it. Many defers in one iteration means the scope was too wide: re-scope.

**Review** every iteration on its delta since `from_ref`, and the whole feature against `base_branch` at each checkpoint.

## Artifact

Written after the build, in English. A refinement of the open iteration updates its artifact in place: rewrite the sections it moved, never append dated notes. Earlier artifacts, the Original request and recorded feedback are never edited.

```yaml
---
feature: <slug>
title: <feature name>
base_branch: <branch at iteration 1, fixed>
branch: <branch of this iteration>
from_ref: <SHA at go>
iteration: <N>
date: <YYYY-MM-DD HH:MM>
source: <spec or ticket link, if any>
---
```

- **Original request** (`001` only): the goal, key flows, constraints, in at most 10 lines.
- **Current state**: what the feature lets the user do today, 3 to 6 bullets from the user's side. No files, no components.
- **What this iteration changes**: written like an MR description, what changes and why in a few sentences.
- **To do**: the table below.
- **Open questions** (when there are any): see below.
- **Feedback** (once I've tested): my feedback as given, and the decisions taken. No rewording that makes it longer.

### To do

One table, read top to bottom in three blocks: `✓` done this iteration, then what's still open from earlier iterations, then `🆕` what this iteration added (my feedback, fast paths taken, spec items found missing). Next iteration, the done rows leave and the new ones join the open block. The open block is sorted by priority; `▶` marks the 2-3 recommended next, favouring fast paths to resolve so they don't pile up.

| | Item | Effort | Origin |
|---|---|---|---|
| ✓ | The supplier sees their price history over 12 months | | |
| ▶ | The buyer can export the history as CSV | M | spec |
| 🆕 | Labels use translation keys instead of raw strings | S | fast path |

`Won't do:` below the table lists what was excluded, each with its reason.

Each item reads like a request from a PO, or from a tech lead when it's technical: understandable without the earlier iterations. No ids, no numbering: an item's wording is its identity, kept the same across iterations. When I ask what's left, answer with the items themselves, ▶ first.

Only work in the repo goes in the table. Only what's in the agreed scope goes in it: the spec, my feedback, the fast paths taken. A new capability, a refactor or any other finding you'd suggest goes to Open questions until I say yes.

### Open questions

What waits on me: a suggestion to add something, or a question I have to take outside the repo (a PO, the translation team). One line each, removed once answered. Only an explicit yes turns a suggestion into a `🆕` item; silence keeps it open.

At iteration 1, walk the spec: every acceptance criterion not delivered becomes an item, or goes under `Won't do`. Work done outside the iterations is reconciled, not narrated: items it completed get `✓` with "outside iterations" as origin, user-visible changes update Current state.

## Handoff

How to test what was built (routes, visible changes), the acceptance criteria, the artifact path, the review outcome, and the open questions. Then ask for feedback and the next focus, and stop.

## Feedback

Add it to the Feedback section of the artifact just tested, never a new file, keeping its substance and severity. Every issue, new requirement or rework decision also becomes a `🆕` item. Read back a short summary, then wait for an explicit go.

## Checkpoint

Every 5 iterations, or sooner if the open items grow two iterations in a row: compare Current state and the table with the Original request, and list each drift (something added, dropped or changed) in one line. For each one I confirm it, recorded as a decision in Feedback so it isn't asked again, or reject it, which becomes a `🆕` item to bring the feature back in line. Then ask whether to keep going or rescope.
