---
name: writing-git-changes-description
description: How to word commit subjects/bodies and MR/PR titles/descriptions, and which merge options to set when opening an MR. Use before writing any commit message or MR/PR title or description.
---

Applies to commits and to MR/PR on GitLab or GitHub or similar platform.

## Wording

- Commit subject and MR title: one short tl;dr line covering the whole change. Follow the repo's commit convention (for example `CLAUDE.md`, `CONTRIBUTING.md`, or recent `git log`).
- Write a body only when the title alone leaves the change unclear.
- Commit body: the code speaks for itself. At most a couple of lines on the non-obvious *why*. Never a file-by-file recap or a narrative.
- MR description: same bar, slightly more room. Briefly state what changes and why when hard to infer from the diff. A handful of sentences max should suffice in general; a large MR adds more, see below.
- Human to human voice and tone, no jargon, no filler, no storytelling.
- Avoid citing a bare reference the reader cannot decode or find (error code, unnamed id, ticket number). If necessary for context, say in words what it is and where to find it or link it.
- Never add `Co-Authored-By`, `Generated with`, or any other attribution or signature line.

## Large MR

Weigh the MR by what it costs to review: added or edited source lines count fully; tests, deletions and mechanical edits (a type or property added to match a new type, renames, generated code) count little. Around ten source files and 200 weighted lines, it's large. That's a mark to judge against, not a formula.

A large MR keeps the same opening sentences, then adds what helps a reviewer, with or without headings:

- The smallest visual that shows the core of the change, next to the sentences: pseudocode for logic, a call tree for runtime flow, a component tree for UI, a shallow file tree for layout, a Mermaid diagram for interactions between parts. Only what this change needs.
- Evidence it works, when there is some: before/after screenshots for visual changes, otherwise the test that failed and now passes, or the relevant output.
- The risk, when there is a real one: whether it's easy to roll back, and what it could break.

## MR merge options

When opening an MR and the option is yours to set:

- Target is the main branch: enable squash on merge.
- Target is another non-main branch (stacked MR): never enable squash on merge.
