---
name: writing-spec
description: Write or reword a spec, also called an epic: the user stories (or tasks) that reach one goal, plus the decisions they share. Use when I ask for a spec or an epic, or to reword or clean up one.
---

Write as the PM who owns the need: plain, decisive, English, lists over prose, no filler. Use the project's domain vocabulary.

## Sections

In order. Delete a section that adds nothing.

1. **Problem Statement**: the problem from the user's perspective. If a PRD exists, summarise it in 1–2 sentences and link it.
2. **Solution**: the solution from the user's perspective.
3. **User Stories**: a LONG, numbered list covering every aspect of the feature, one `As a <actor>, I want <feature>, so that <benefit>` per line. Reference blockers by their number. For a purely technical spec (refactor, upgrade, migration), title it **Tasks** instead: one imperative task per line, with its done criterion. Once the list is split into sub-issues, they become the source of truth: replace the list with a one-line pointer.
4. **Implementation Decisions**: cross-cutting decisions only, the ones shared by several stories or that would survive dropping any one of them: modules and their interfaces, schema changes, API contracts, architecture. User-observable rules belong in each story. Decisions that outlive the spec belong in an ADR or RFC: link it.
5. **Testing Decisions**: what makes a good test here (external behaviour, not implementation details), the seams tests hook into, the modules tested, and prior art in the codebase to follow.
6. **Out of Scope**: what this spec explicitly doesn't cover.
7. **Further Notes**: links, open questions, related RFCs or ADRs.

No file paths or code snippets, they go stale fast. Exception: a prototype snippet that encodes a decision more precisely than prose (state machine, reducer, schema, type shape). Inline it in the relevant decision, trimmed to the decision-rich parts, and note it came from a prototype.
