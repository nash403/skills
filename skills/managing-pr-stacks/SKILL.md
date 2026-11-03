---
name: managing-pr-stacks
description: "Open and update a stack of PRs or MRs, each targeting the branch of another instead of the base branch: merge options when opening one, and pushes that run CI only where it pays off when updating the whole stack. Use when opening a PR or MR on a non-base branch, or when I ask to update, rebase or push a whole stack."
---

A **PR stack** is a set of PRs or MRs where each one targets the branch of another instead of the base branch (`main`, `develop`…). **Linear** when it's a chain, a **tree** when some branches share a parent.

## Opening a stacked PR or MR

- Target the parent's branch, not the base branch.
- When the option is yours to set, never enable squash on merge: it rewrites the commits the branches above are built on.

## Updating the whole stack onto its base

When I ask to bring the entire stack up to date with its base branch, update each branch onto its parent from the bottom up, then push them all with CI skipped, except one:

- **Linear**: the tip, which carries every change of the stack.
- **Tree**: the bottom branch, the one every other branch builds on.

Then list the branches pushed without CI, so I can rerun the ones I care about.

A branch I change and push on its own, even inside a stack, is a normal push: CI runs.

### Pushing without CI

Take the command from the project context. When it's not there, find how the platform skips CI on a push (GitLab: `git push -o ci.skip`), use it, then suggest recording it in my personal context folder (`setup-personal-context`).

Some platforms only skip CI through commit messages (GitHub's `[skip ci]`). Never rewrite commits for this: push normally, tell me CI will run on every branch, and suggest recording that there's no skip command.
