---
name: code-review
description: "Review a range of code changes (a branch, a PR/MR, or work in progress since a fixed point) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review the code, a branch, a PR, work-in-progress changes, or asks to \"review since X\"."
---

Two-axis review of the diff between a base (a fixed point) and a head:

- **Standards**: does the code conform to this repo's documented coding standards?
- **Spec**: does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

## Process

### 1. Pin the range

The base is the fixed point the user gave (a commit SHA, branch name, tag, `main`, `HEAD~5`, etc.). If they didn't give one and the target doesn't imply it, ask for it. The head depends on what's under review:

- **Local branch**: `HEAD`.
- **PR/MR**: fetch its head (`refs/merge-requests/<iid>/head` on GitLab, `pull/<n>/head` on GitHub) and use that SHA. The base defaults to its target branch, fetched too. Read code at the head with `git show <head>:<path>`, or from a worktree following `working-with-worktrees` when you need to navigate it, never from the user's working copy.

Capture the diff command once: `git diff <base>...<head>` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <base>..<head> --oneline`.

**Uncommitted work.** When the changes under review aren't committed yet — the user says "pending", "working tree", "what I have right now", or the three-dot diff comes back empty while `git status` is dirty — review the working tree instead: `git diff <base>` (two-dot, comparing the working tree against the ref), plus the untracked files from `git ls-files --others --exclude-standard`. Untracked files show nothing in the diff, so read them in full and pass them to the sub-agents alongside it.

Before going further, confirm both ends resolve (`git rev-parse <base> <head>`) and that there is something to review. A bad ref, or an empty diff with a clean working tree, should fail here, not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. For a PR/MR: its linked issue, else its description.
2. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.) or matching the branch name or feature using the project's issue tracker naming convention.
3. A path the user passed as an argument.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

Anything in the repo that documents how code should be written: agent files (`CLAUDE.md`, `AGENTS.md`, rules) and docs such as `CODING_STYLE.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **baseline**: call the Skill tool with "clean-code" and take its rules and its `smells.md`. It applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the finding.
- **Smells are judgement calls.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation. Like any standard here, skip anything tooling already enforces.

This step is done when the baseline is ready to paste. The baseline is these smells, by name: Mysterious Name, Duplicated Code, Long Function, Long Parameter List, Global Data, Mutable Data, Divergent Change, Shotgun Surgery, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches, Speculative Generality, Temporary Field, Message Chains, Middle Man, Insider Trading (Fowler, _Refactoring_ ch. 3), Flag Arguments, Dead Code, Hidden Temporal Coupling (Martin, _Clean Code_ ch. 17).

### 4. Spawn both sub-agents in parallel

**Standards sub-agent prompt** should include:

- The full diff command and commit list, and for a PR/MR how to read files at the head.
- The list of standards-source files you found in step 3, **plus the baseline from step 3** pasted in full (the sub-agent has no other access to it).
- The brief: "Report, per file/hunk where relevant, (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline rule the diff breaks or baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls: documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces. Under 500 words."

**Spec sub-agent prompt** should include:

- The diff command and commit list, and for a PR/MR how to read files at the head.
- The path or fetched contents of the spec.
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 500 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings, because the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes: that's the reranking the separation exists to prevent.

When a Standards finding rests on a convention the codebase follows but no doc records, offer to record it in the project's coding standards: `CODING_STYLE.md` at the root by default, created if there's none.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
