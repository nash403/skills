---
name: managing-pr-stacks
description: "Open and update a stack of PRs or MRs, each targeting the branch of another instead of the base branch: merge options when opening one, and pushes that run CI only where it pays off when updating the whole stack. Use when opening a PR or MR on a non-base branch, or when I ask to update, rebase or push a whole stack."
---

A **PR stack** is a set of PRs or MRs where each one targets the branch of another instead of the base branch (`main`, `develop`…). **Linear** when it's a chain, a **tree** when some branches share a parent.

## Opening a stacked PR or MR

Target the smallest honest diff, so a reviewer never rereads a parent's changes. The **destination** is the branch it finally lands in.

- **No dependency**: target the destination.
- **One dependency**: target its branch. Different destinations: open as draft, say in the first line where it lands. It shall be retarget once the destination contains the dependency, and marked ready.
- **Several dependencies**: branch from a merge of their heads, target the destination and state the requirements before review. Ask before creating a join branch.

Always link every dependency as blocking where the platform allows it, never enable squash until it targets the base (it rewrites the commits the branches above are built on), and list the stack in review order.

## Updating the whole stack onto its base

When I ask to bring the entire stack up to date with its base branch, update each branch onto its parent from the bottom up, then push them all with CI skipped, except one:

- **Linear**: the tip, which carries every change of the stack.
- **Tree**: the bottom branch, the one every other branch builds on.

Then list the branches pushed without CI, so I can rerun the ones I care about.

A branch I change and push on its own, even inside a stack, is a normal push: CI runs.

### Pushing without CI

Take the command from the project context. When it's not there, find how the platform skips CI on a push (GitLab: `git push -o ci.skip`), use it, then suggest recording it in my personal context folder (`setup-personal-context`).

Some platforms only skip CI through commit messages (GitHub's `[skip ci]`). Never rewrite commits for this: push normally, tell me CI will run on every branch, and suggest recording that there's no skip command.
