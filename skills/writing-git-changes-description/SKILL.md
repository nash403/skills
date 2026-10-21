---
name: writing-git-changes-description
description: How to word commit subjects/bodies and MR/PR titles/descriptions, and which merge options to set when opening an MR. Use before writing any commit message or MR/PR title or description.
---

Applies to commits and to MR/PR on GitLab or GitHub or similar platform.

## Wording

- Commit subject and MR title: one short tl;dr line covering the whole change. Follow the repo's commit convention (for example `CLAUDE.md`, `CONTRIBUTING.md`, or recent `git log`).
- Write a body only when the title alone leaves the change unclear.
- Commit body: the code speaks for itself. At most a couple of lines on the non-obvious *why*. Never a file-by-file recap or a narrative.
- MR description: same bar, slightly more room. Briefly state what changes and why when hard to infer from the diff. A handful of sentences max should suffice in general.
- Human to human voice and tone, no jargon, no filler, no storytelling.
- Avoid citing a bare reference the reader cannot decode or find (error code, unnamed id, ticket number). If necessary for context, say in words what it is and where to find it or link it.
- Never add `Co-Authored-By`, `Generated with`, or any other attribution or signature line.

## MR merge options

When opening an MR and the option is yours to set:

- Target is the main branch: enable squash on merge.
- Target is another non-main branch (stacked MR): never enable squash on merge.
