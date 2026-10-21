---
name: implementation-loop
description: "Workflow for implementing a ticket, a spec or a feature: mindset, branch, test-first at agreed seams, checks, review, commit only on request. Use whenever asked to implement or build something."
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

- **Safe data**: a migration is safe on existing data and compatible with the code already deployed (expand, migrate, contract). No destructive migration without my explicit go.
- **Stable contract**: don't break consumers. Add rather than change, deprecate before removing.
- **Guarded edges**: every new endpoint checks permissions and validates its input.
- **Failure modes**: writes, jobs and webhooks are idempotent; outbound calls have timeouts; multi-step writes are atomic.
- **Query cost**: no N+1, an index for every new query pattern, pagination for any list that can grow.
- **Useful logs**: errors logged with their context, never secrets or personal data.

## Workflow

1. **Branch.** If you're on the default branch, create one following the project's naming convention; ask if there's none.
2. **Build** test-first at pre-agreed seams with `tdd`, wherever it applies. Keep the checks green as you go, following `running-checks`.
3. **Review** the work with `code-review`.
4. **Commit** to the current branch only if I explicitly asked. Otherwise, or if unsure, follow `suggest-commit`.
