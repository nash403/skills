---
name: writing-adr
description: Record an architecture decision as an ADR (architecture decision record). Use when I ask for an ADR, to record or document a technical decision, or when an accepted RFC needs its decision recorded.
---

An ADR records that a decision was made, and why. It's a log, not living documentation.

## When it's worth one

An ADR is worthy to be offered only when all three are true:

1. **Hard to reverse**: changing your mind later has a real cost.
2. **Surprising without context**: a future reader would wonder why it was done this way.
3. **A real trade-off**: there were genuine alternatives and one was picked for specific reasons.

What qualifies: architectural shape, integration patterns between contexts, technology choices with lock-in (database, message bus, auth provider, not every library), boundary and scope decisions, deliberate deviations from the obvious path, constraints the code doesn't show, and rejections that aren't obvious (otherwise someone suggests the same thing again in six months).

## File

Number it sequentially: scan the ADR folder for the highest number and add one. Name it `NNNN-decision-in-kebab-case.md`, the title stated as the decision (`0003-use-postgresql-over-mongodb.md`).

## Format

```md
---
status: accepted
date: YYYY-MM-DD
decision-makers: <names>
---

# {Short title of the decision}

{1-3 sentences: the context, what was decided, and why.}
```

The front matter is mandatory. The body can be a single paragraph: the value is in the record, not in filled-out sections. Add these only when they earn their place:

- **Considered options**: when the rejected alternatives are worth remembering.
- **Consequences**: when non-obvious downstream effects need calling out.

When the decision comes from an RFC, keep the ADR short and link the RFC.

## Status and immutability

Status is one of `proposed`, `accepted`, `deprecated` or `superseded by ADR-NNNN`. Once accepted, the decision in an ADR doesn't change: to revisit it, write a new ADR that supersedes it and only update the old one's status. Fixing a typo or an inaccuracy that doesn't change the decision is fine.
