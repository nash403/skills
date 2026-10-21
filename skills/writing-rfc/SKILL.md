---
name: writing-rfc
description: "Write or reword an RFC (request for comments): a design proposal put up for discussion before a decision is made. Use when I ask for an RFC, a design proposal or a request for comments."
---

An RFC proposes; it comes before the decision. An ADR records the decision after it. When an RFC is accepted, offer a short ADR that links to it.

As a file, name it `NNNN-feature-name.md` with the next free 4-digit number, unless the project numbers RFCs differently.

Start with a header table: `Status | Author | Reviewers | Created | Decided`. Status goes `Draft` → `In Review` → `Accepted`, `Rejected` or `Withdrawn`.

## Sections

In order.

1. **Summary**: one paragraph.
2. **Motivation**: the problem, the use cases, the expected outcome.
3. **Detailed design**: enough for someone who knows the codebase to implement it: interfaces, data model, interactions, edge cases. Diagrams welcome.
4. **Drawbacks**: why not do this: cost, complexity, migration burden, maintenance.
5. **Alternatives considered**: each rejected design and why, including doing nothing.
6. **Adoption strategy**: rollout, breaking changes, migration path.
7. **Unresolved questions**: what review, implementation or a later RFC must settle.
8. **Decision**: left empty until the review closes, then outcome, rationale and links to the resulting projects or epics.

Drawbacks and alternatives are never empty: an RFC without them argues for a decision already made instead of informing one.
