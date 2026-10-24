---
name: retro
description: Run a retrospective on a coding session and suggest changes to the agent's environment (files, checks, tooling) so the next runs go better.
disable-model-invocation: true
---

Look back on a session and suggest what to change in the agent's environment so the next runs go better. Write every suggestion following `maintaining-docs`.

## 1. Read the session

The ones I name, searching the session logs on this machine if needed. Otherwise the current one.

## 2. Find the candidates

- **Navigation**: the agent struggled to find a file or a piece of information. Would a pointer from the code map (`mapping-codebase`), the docs map (`mapping-doc-ownership`) or `CLAUDE.md` have helped? Also look for hidden dependencies between files.
- **Automated checks**: a lint, type, test or other check could have caught the agent's mistake. First read the checks the repo already has (manifest scripts, CI workflow): a check that exists but isn't wired, or is broken, is a finding in itself. So is a repo with no guardrail at all.
- **Coding standards**: the review missed a mistake. Classify the rule first. A mechanical one becomes a deterministic check (lint rule, pre-commit hook, CI job). Only a real judgement call goes in `CODING_STYLE.md`.
- **Steering files**: `CLAUDE.md`, `AGENTS.md` or a skill carries instructions that belong in the coding standards or a check, or no-ops that don't change the agent's behavior.
- **Tool economy**: tool calls that cost a lot, or custom tooling (CLIs, MCP servers) that wastes tokens and could be streamlined.
- **Information access**: the agent lacked something it needed, such as dev server logs or read-only access to a third-party service.

## 3. Report

Present the candidates to me, most severe first.

## Where things go

- **Implementation vs review**: the implementing agent works under heavy context pressure from exploring, coding and debugging. The review (`code-review`) gets only the diff, so it's the better place to enforce coding standards.
- `CLAUDE.md` and `AGENTS.md` load into every agent's context: keep them minimal, mostly pointers.
- `CODING_STYLE.md` is read at review. When it grows too long, point to the docs that own each topic.
- Docs are reference that other files point to. Check the existing ones before writing a new one.
- A skill fits reference the agent loads on its own, its description sitting in the context, or a command I invoke.
