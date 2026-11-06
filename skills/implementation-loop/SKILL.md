---
name: implementation-loop
description: "Workflow for building anything, asked in the prompt or written in a ticket or spec: mindset, framing before code, branch, test-first at agreed seams, checks, review, a user-facing hand back, commit only on request, then continue or hand off. Use whenever I ask to build, implement, add or change something in code, even in a one-line request."
---

## Mindset

Principles for all feature-building workflows. Internalize before starting any work.

- **UX-first**: every technical decision serves the end user's experience.
- **Challenge assumptions**: if a requirement is vague, risky, or overengineered, say it.
- **Propose tradeoffs**: identify fast paths that deliver 90% of value with 50% of effort.
- **Defend coherence**: reject changes that create data inconsistencies or break colocated features.
- **Be direct**: clear recommendations with rationale, no filler.

### When the work has a UI

- **Production-grade UI**: every output must look and feel like a shipping product, not a prototype. Respect the design system tokens, spacing scale, and visual hierarchy. If it looks like generic AI-generated UI (flat, uniform, with no information hierarchy), it's not done.
- **Intentional density**: layout decisions (density, spacing, grouping, emphasis) must be deliberate, not defaults, and match the product: compact, scannable layouts (tables, dense lists, summary cards) for data-heavy professional tools, more air where users browse rather than scan. Use typographic hierarchy (weight, size, color) to guide the eye from primary action to supporting context.
- **Purposeful motion**: animations serve user understanding: state transitions, spatial context (panel opening, element appearing), and action feedback (confirmation, error). Avoid motion that delays access to information or exists purely for visual flair. A subtle fade-in is fine; a staggered reveal on a data list is noise.

### When the work has a backend

- **Safe data**: a migration is safe on existing data and compatible with the code already deployed (expand, migrate, contract, following `sequencing-changes`). No destructive migration without my explicit go.
- **Stable contract**: don't break consumers. Add rather than change, deprecate before removing.
- **Guarded edges**: every new endpoint checks permissions and validates its input.
- **Failure modes**: writes, jobs and webhooks are idempotent; outbound calls have timeouts; multi-step writes are atomic.
- **Query cost**: no N+1, an index for every new query pattern, pagination for any list that can grow.
- **Useful logs**: errors logged with their context, never secrets or personal data.

## Workflow

1. **Frame.** Read the spec, its linked tickets and any mockups, then hand back:
   - findings: what exists, what conflicts, what the APIs, contracts and data it depends on actually expect;
   - a proposed split: commits, stacked MRs, parallel MRs, or a mix, ordered following `sequencing-changes`;
   - the open decisions, TDD seams included, settled with `grilling`, never left as a list.

   End by asking whether we're aligned. Build only after my yes. When I ask a question, answer only that.
2. **Branch.** If you're on the default branch, create one following the project's naming convention; ask if there's none.
3. **Build** following the project's documented coding standards (`CODING_STYLE.md`, `CONTRIBUTING.md`…) and `clean-code`, test-first at the seams agreed in step 1 with `tdd`, wherever it applies. Keep the checks green as you go, following `running-checks`.
4. **Review** the work with `code-review`.
5. **Hand back** each commit or batch:
   - what changes for the end user, worded so I can test it by hand;
   - a few code anchors, never the inventory of every function touched;
   - risks and open items outside scope, e.g. a backend guard another team owns.
6. **Commit** to the current branch only if I explicitly asked. Otherwise, or if unsure, follow `suggest-commit`.
7. **Continue.** When items of the agreed split remain, offer to go on in this session or to write a handoff with `handoff` so a fresh session picks up the next item. The handoff carries the rest of the split, so that session can hand off the item after it too.
