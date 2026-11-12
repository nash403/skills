---
name: auto-mode-orchestrator
description: "Carry a large piece of work to its finish line as an orchestrator: a long description, a list of tickets, or a ticket with sub-tickets. Background sub-agents do all the work, a wiki keeps the state through compactions, and I'm pinged only when it matters."
argument-hint: "The work, plus 'Finish line: hand-back | land' and 'Commit gate: gated | free'"
disable-model-invocation: true
---

You orchestrate; sub-agents do all the work. Think on two tracks: **tactical**, how the next node of the tree gets done, and **strategic**, what the environment needs so the next sub-agent does better.

## Settings

The prompt states both; ask for a missing one before anything else.

- **Finish line**: `hand-back` stops with every branch and PR/MR open, and I merge. `land` also merges the tree into the destination the prompt names, resolving conflicts with `resolving-merge-conflicts`; never into a protected or default branch it doesn't name.
- **Commit gate**: `gated` stops before each commit and sends me the worktree, branch, diff command and where the run stands; I answer "go" or "change this first". `free` commits without me.

## Start

1. **Tree**: use the order the input gives (commits, PRs/MRs, tasks). Otherwise have a sub-agent run the Frame step of `implementation-loop`. Done when each node has its scope, branch, base and dependencies.
2. **Environment**: have a sub-agent learn the checks (`running-checks`), dev servers, ports, shared services, the docs that own each topic and the tracker (`using-personal-context`), then record pointers and hard-won facts in the wiki, with how agents share ports, caches and the lockfile. Done when a sub-agent could start from that section alone.

## Sub-agents

- Background, fresh context window, briefed through pointers (the wiki's absolute path, tickets, commits), never copies.
- Medium effort for implementers, a notch higher for reviewers, a cheaper model for clean-up.
- Parallel when dependencies and machine load allow: check the load before dispatching builds, tests or dev servers. Benchmarks run alone, several times, reporting the median.
- Worktrees follow `working-with-worktrees`; never touch my main checkout's index.
- `spawn-session` only at a key moment: it can't be invoked as a skill, so read its `SKILL.md` (`../spawn-session/SKILL.md` from this skill's folder) and follow it, adapted to the run.

Each implementer follows `implementation-loop` from Branch to Review; the settings replace its Hand back and Commit steps. Before every commit, clean-up agents run `deslop` and `cleanup-comments` on its diff and it applies their findings. It opens its PR/MR (`managing-pr-stacks` for stacks, draft when blocked) and moves its ticket with `syncing-ticket-status`, never to done.

Judge every report before it moves the run: check its claims against cited commands and results. A runner that fails is not a pass. The same check failing twice: stop that thread and escalate. Push only to this run's branches and the `land` destination.

## Talking to me

Ping me only for a question only I can answer, a blocker that changes course, or a gated commit; handle the rest and record it in the wiki. Notify right away, with a push notification when available.

Ask as a `grilling` round, each question with your recommended answer. A sub-agent's question goes in quoted verbatim, with its node's name. For an unforeseen problem, stop only that thread and offer: a new ticket (and where it goes in the tree), a task in your plan, nothing, or out of scope.

Load `unslop` before writing tickets, comments in code, PR/MR text or the wiki.

## Wiki

`auto-mode-wiki.md`, created at first need in the personal context folder of the main checkout, beside the work's tickets; else follow `placing-produced-documents`. Read it before each decision and after a compaction.

You own Environment, State (per node: branch, worktree, PR/MR, status, what waits on me), Decisions and Recurring problems. Each sub-agent writes only its own section. Make small targeted edits, cite sources rather than copy them, and condense when it grows.

Write history: date each claim, cite the commit (with its repo) for claims about code, and mark a claim superseded by a new dated one instead of rewriting it.

## Finish

`hand-back`: every PR/MR open with green checks cited, dev servers stopped. `land`: the tree is in the destination. Then report per node: branch, PR/MR, status, what waits on me.
