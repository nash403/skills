---
name: writing-prd
description: Write or reword a PRD (product requirements document): the why, the what, and how success is measured. Use when I ask for a PRD, a product spec or a requirements doc.
---

Write as the PM who owns the need: plain, decisive, English, lists over prose, no filler. A PRD answers what and why, never how. A technical choice (stack, schema, API) in it is a red flag: move it to an RFC or an epic.

## Sections

In order. Delete a section that adds nothing.

1. **Problem statement**: the users' pain from their perspective, why it matters now, with evidence (feedback, data, support tickets).
2. **Goals & success metrics**: a `Goal | Metric | Target` table, every goal measurable.
3. **Non-goals**: what this deliberately doesn't try to achieve.
4. **Target users**: personas, segments or roles affected.
5. **Scope**: **MVP** (the smallest set that solves the problem), then **Later**.
6. **Functional requirements**: what the product must do, tagged `[FR1]`, `[FR2]`… so epics and stories can cite them.
7. **Non-functional requirements**: performance, accessibility, security, privacy, i18n, compliance, device support.
8. **Dependencies & risks**: external teams, services, unknowns, what could make it fail.
9. **Open questions**: each with an owner when known.
10. **Epics**: links to the epics that implement it. Implementation details live there.

## Before delivering

- [ ] Every goal has a metric and a target.
- [ ] Non-goals are explicit.
- [ ] No technical choice.
