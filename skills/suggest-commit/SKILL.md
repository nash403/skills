---
name: suggest-commit
description: Stop before committing, hand the changes back for review, and propose a commit message I can use myself.
disable-model-invocation: true
---

Stop here after your work before any commit. Do not run `git commit`, `git push`, or stage anything — I review the changes myself.

Instead:

1. Give me a one-paragraph summary of what changed and where, so I know what to look at first.
2. Flag anything you are unsure about or deliberately left out.
3. Propose a single commit message in a plain code block, ready to copy:
   - Follow the repo's commit convention (check for example `CLAUDE.md`, `CONTRIBUTING.md`, or recent `git log`).
   - Subject: imperative, lowercase, no trailing period, max 72 chars.
   - Body only when the *why* isn't obvious from the subject; wrap at 100 chars; no bullet dump of every file.
   - No co-author or tool attribution lines.

If I ask for changes to the message, revise it — still without committing.
