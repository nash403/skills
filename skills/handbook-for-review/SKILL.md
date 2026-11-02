---
name: handbook-for-review
description: "Write a review handbook for a branch or MR: the diff split into cohorts (one concern each, a file can sit in several), each saying what kind of change it is, how deep to read, where to look and what to check. For a human reviewer, with or without an agent. Use when I ask for a review handbook or a guide to review a change."
---

Write a handbook a person can follow to review a change by hand. The reader has the repo checked out at the change and git, and nothing else: no agent, maybe no knowledge of the subject. The handbook guides the review; it never concludes approve or block.

## Cohorts

A cohort is one concern the reviewer verifies in one go: a capability, a contract change, a migration, a rename, a permission rule. It points at hunks and symbols, not whole files, so a file can appear in several cohorts, each time for a different passage and a different reason. Cut cohorts so that each answers one question; split one that needs two.

For each cohort, give:

- **Type**: what kind of change it is, e.g. new behavior, behavior change, contract change, migration, mechanical refactor, config, tests, i18n.
- **Depth**: read line by line, skim, or check one sample, alone or combined, plus a search for leftovers when the change repeats. A 40-file rename is a sample plus a search.
- **Risk**: low, medium or high.
- **Where to look**: `path:line` or `path` + symbol, local to the repo. Unchanged code the reader needs to judge the change belongs here too, marked `(unchanged)`.
- **What to check**: 1 to 4 checks, each tied to code the reader can open or a git search they can run, most severe first. For an app that means correctness and regressions, data exposure, async state, user-facing flow, then maintainability; adapt the order to what the change can break. A check may walk the reader through a suspicious scenario; it never states the conclusion for them.
- **Linked cohorts**: the cohorts that share a file with this one, or a value or contract passed between them, and what each takes from the other.

Unclear intent goes to the author as a question; an inconsistency the code shows goes in a check. Never both for the same point.

## Workflow

1. Resolve the diff: the branch, MR, commit or range I name. For a branch or MR, diff against its base, else the default branch, and include uncommitted changes. Line numbers refer to that revision.
2. Find the intent: the ticket, the MR description, the commit messages. If the change is mine, state the intent and add what a reviewer can't guess: deliberate shortcuts, questionable choices made on purpose, places I'm unsure about. If it's someone else's, take the intent from those sources only. Where it's unclear, say so as a question for the author; never infer it from the code.
3. Read the whole diff and the code around it: callers, contracts, schemas, shared types, even outside the reader's usual area.
4. Cut the cohorts. Order them by dependency: what other cohorts build on comes first. In an app that is the data flow: data and model, then API and contract, then client state, then UI. Among cohorts that don't depend on each other, put mechanical low-risk ones first so the reader clears them fast. When a high-risk cohort lands in the second half, say so in one line under the review order.
5. Check coverage before writing: every changed file falls in at least one cohort, else a cohort is missing. A file that should have changed and didn't becomes a search check in the cohort it belongs to. Cite a renamed file as `old → new`.
6. Write the hand tests when the change has behavior someone can trigger (UI, API, CLI, library call): 3 to 5 scenarios at most, one line each, precondition, action, expected result, cohort. Start from the ticket's criteria, then the suspicious scenarios of the risky cohorts. The expected result comes from the intent, never from what the code does. No observable behavior, no section.
7. Add a glossary only when a term would block the reader.
8. Output one Markdown block, ready to paste anywhere. When I ask for a page, make it a single HTML page with a checkbox per cohort so the reader can track progress across sittings.

## Template

Adapt headings to the diff. Keep it dense: as many cohorts as the change has questions, not files, and a cohort fits on one screen.

````markdown
# Review handbook · <change title>

## Context

<2 to 4 lines: what the change does, for whom, why.>
<When the base isn't obvious, the diff command, e.g. `git diff <base> <branch>`.>

<If the change is mine: Watch out for · <doubt or deliberate shortcut, with path:line>.>
<If not: Questions for the author · <unclear intent>.>

## Review order

1. **<Cohort>** · <type> · <depth> · <risk>
2. **<Cohort>** · <type> · <depth> · <risk>

<If a high-risk cohort lands in the second half: one line saying so.>

## Try it by hand

1. <precondition>; <action>. Expect <result the intent calls for>. (cohort <n>)

---

## 1. <Cohort>

<One line: the question this cohort answers.>

Where to look:
- `<path>:<line>` · `<symbol>`: <what this passage does here>
- `<path>:<line>` · `<symbol>` (unchanged): <why the reader needs it>

Check:
- In `<symbol>`, <specific behavior to verify>.
- Trace <scenario> through `<symbol>` and `<symbol>`.

Linked: cohort <n> (<what they share>).

---

## Glossary

- `<term>`: <definition useful for this review>.
````

## Quality bar

- Every check points at code the reader can open or a git search they can run. "In `<symbol>`, verify…" beats general advice.
- No passage is described twice: a file in two cohorts gets a different passage or a different angle in each.
- No checklist that would fit any other change.
