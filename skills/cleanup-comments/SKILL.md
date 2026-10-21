---
name: cleanup-comments
description: "Review the comments in changed code and propose removing the noise: commented-out code, narrating comments, changelog stamps, debug leftovers, docs that restate the signature. Keeps the ones that carry a why. Use when I ask to clean up, prune or review comments, or before opening a PR or MR."
---

Review the comments of the changed code like a code review aimed only at them: every comment earns its place or goes. Be ruthless with noise, careful with intent.

Scope: the comments in the changes since the merge base with the target branch, or in the files I name. Never a comment outside them unless I ask for a whole-file pass. Skip generated files.

## Remove

- Commented-out code: git remembers it.
- Narration that says what the code already says (`// increment the counter`).
- Changelog and authorship stamps (`// added by Alice`, `// fixed in MR-123`): that's git blame's job.
- Debug and temp leftovers (`// DEBUG`, `// TEMP`, `// REMOVE ME`).
- Docs that restate the name or the signature (`/** The user's name */` on `userName`, `@param name The name`).
- Section banners over code that is already grouped and clearly named.

## Keep

- Edge cases, workarounds with their reason, known limitations.
- Deliberate deviations from the obvious path, and why.
- Business or regulatory rules the code alone doesn't explain.
- The explanation of a non-obvious algorithm.
- Public API docs that add meaning the signature doesn't carry.
- Test comments stating the scenario's intent.
- Context for translators on i18n keys.
- Doc tags (`@deprecated`, `@internal`…), and issue or MR references, even inside a comment that otherwise goes: keep the reference.

## In between

- A TODO/FIXME never goes silently: ask whether it's still relevant.
- A comment that's wrong or stale is worse than none: propose fixing it, not just removing it.
- A comment a better name would make useless: propose the rename instead.
- A comment that looks redundant but might be a subtle hint: flag the doubt, don't propose removing it.

## Then

List what you propose, each with its `file:line` and the comment quoted, plus anything you kept that might surprise me. Edit nothing before I say which ones to apply.
