---
name: maintaining-docs
description: Edit AI agent files (skills, rules, AGENTS.md/CLAUDE.md) or project documentation (READMEs, ARCHITECTURE, CODING_STYLE, CONTRIBUTING, monorepo/package docs) with the right reviewer stance, preserving the file's existing tone and workflow. Use when asked to edit, update or clean up one of these files.
---

Your role is to edit docs or AI agent files with the right reviewer stance.

## 1. Classify or abort

- **AI agent files**: `SKILL.md`, `CLAUDE.md`, `AGENTS.md`, rules. Files whose purpose is to steer agent behavior.
- **Project documentation**: `README.md`, the glossary (`GLOSSARY.md`), the docs and code maps (`DOCS-MAP.md`, `CODE-MAP.md`), `ARCHITECTURE.md`, `CODING_STYLE.md`, `CONTRIBUTING.md`, `docs/*.md` or a sub-package's `README.md`.
- Ambiguous (e.g. a rule that secretly owns architecture content): ask one clarifying question, then pick the dominant intent.
- Neither: abort with a one-line explanation. Do not edit.

## 2. Rules for both

- Read the full target file before editing.
- Preserve the file's existing tone, terminology, and section order. Replace a workflow only if the user requests a new one, and replace it fully: no orphaned steps or stale references.
- Stay within request scope. Coherence refactors only when the requested edit would otherwise leave adjacent guidance contradictory, duplicated, or ambiguous.
- Anchor on the project's docs map, if any, and the area-local agent guide (like `CLAUDE.md`). Defer to them for placement, link hygiene, anti-duplication, size budgets, frontmatter shape, frontend targeting. Do not restate.
- Write in an expert tone for the target stack and area: backend, frontend, Django, React, Jest or Vitest, etc.
- Stop and ask before architecture, ownership, or workflow shifts.

## 3. Adopt the stance

### AI agent files: senior AI agent skill creator

Enforce, do not narrate:

- Token-cost discipline. Cut what the agent already knows from `CLAUDE.md`, active rules, and adjacent skills. Every paragraph earns its tokens.
- Directive imperatives. No exploratory prose, no motivational filler. Write the shortest version that still leads to the correct action.
- Stable terminology. Concrete examples over abstract description when output shape matters.
- Routing, not ownership. AI agent files point to durable docs; they never own decisions a doc owns.
- Generic files stay generic. A file that applies across packages names none ("the target package"), except as a labelled example; a package-scoped file is explicit about its paths and commands. Test: would renaming the package force an edit here, though the file isn't about it? Then it's too specific.
- Let severity keywords carry weight. MUST/DO/PREFER signal importance; drop "it is very important that" and whole-sentence bold.

### Project documentation: senior maintainer of repo documentation

Enforce, do not narrate:

- Route to the owner doc per the docs map before writing a line.
- Match the existing doc's voice and structure; do not flatten or modernize tone unless asked.
- Coherence over completeness. Align adjacent docs in the same change only when the edit makes them outdated or contradictory.

## 4. Verify

- Classification was explicit; non-target files were rejected, not stretched into project documentation.
- Target file's tone, terminology, and section order remain consistent post-edit.
- Intended workflow (initial or newly requested) is the only one reflected: no leftovers from the previous structure.
- Anchor docs were consulted, not duplicated. Is any rationale longer than its rule? Does any sentence restate the one above it? If yes, cut.

## Output

Two lines: classified category, touched files, deferred questions. Cite `file:line` for non-obvious edits.
