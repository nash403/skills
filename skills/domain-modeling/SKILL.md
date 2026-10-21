---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing its glossary (often CONTEXT.md), or recording or editing an ADR.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design: challenge terms, invent edge-case scenarios, and write the glossary and decisions down the moment they crystallise. Merely reading the glossary for vocabulary doesn't need this skill.

## File structure

First find where the project already keeps its glossary and ADRs: the committed files (`CLAUDE.md`, `AGENTS.md`, `docs/`…), then the project context. Use what exists, whatever its name. The layouts below are the defaults for when there's none yet.

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

A context isn't tied to a package. A folder deeper down (`src/features/checkout/`) gets its own `CONTEXT.md` only when it has its own language: terms that mean something else there than in the enclosing context, or enough terms of its own to clutter it. Otherwise its terms go in the enclosing glossary. Each term lives in one context only, and `CONTEXT-MAP.md` lists every context, whatever its depth: creating the second context creates the map. For a given piece of code, the glossary that applies is the nearest `CONTEXT.md` up the tree, then those above it.

Create files lazily: only when you have something to write. If there's no glossary, create a root `CONTEXT.md` when the first term is resolved. If there's no ADR folder, create `docs/adr/` when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in the glossary, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update the glossary inline

When a term is resolved, update the glossary right there. Don't batch these up: capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

The glossary should be totally devoid of implementation details. Do not treat it as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

When a decision crystallises that deserves an architecture decision record, offer to record it as an ADR. Most don't.
