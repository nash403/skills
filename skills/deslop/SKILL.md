---
name: deslop
description: Remove AI-generated code slop and clean up code style
---

# Remove AI code slop

Check the diff against main and remove AI-generated slop introduced in the branch.

## Focus Areas

- Comments. Keep only what the code cannot say: a why, an invariant, a non-obvious constraint. Delete narration ("first we...", "now that...", "this handles the case where..."), prose that restates the next line, and change history ("previously", "to fix the bug"). Rewrite what remains per the "Plain speech" section of `unslop`. Skip its "Adding soul" section, a comment wants no voice. Test: if the comment cannot be restated as a fact, a constraint or a number, cut it.
- Defensive checks or try/catch blocks that are abnormal for trusted code paths
- Casts to `any` used only to bypass type issues
- Deeply nested code that should be simplified with early returns
- New small utils (formatters, predicates, mappers). Tell: it would read the same in another project. Grep the codebase and installed deps for an equivalent. Exact match: reuse. Near match needing a widening: keep the new one, flag both in the summary.
- Other patterns inconsistent with the file and surrounding codebase

## Guardrails

- Keep behavior unchanged unless fixing a clear bug.
- Prefer minimal, focused edits over broad rewrites.
- Keep the final summary concise (1-4 sentences, including raised flags).
