---
name: improve-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities**: refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This command is _informed_ by the project's domain model and built on a shared design vocabulary:

- `designing-deep-modules` holds the architecture vocabulary and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Use its terms exactly in every suggestion.
- The project's glossary (often `CONTEXT.md`) gives names to good seams; its ADRs (often in `docs/adr/`) record decisions this command should not re-litigate. Find where the project keeps them in the committed files, then the project context. Project documents such as `CODING_STYLE.md` or `CONTRIBUTING.md` may be relevant as well.

## Process

### 1. Explore

**Scope before you scan: YAGNI.** Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed. Decide *where* to look before you look:

- If the user named a direction (a module, a subsystem, a pain point), take it, and skip the inference below.
- Otherwise, find the hot spots, the files that keep changing, and let those paths pull your attention first: `git log --since=6.months --format= --name-only | sort | uniq -c | sort -rn | head -30`. If the changes are scattered with no clear hot spot, widen the net.

Read the project's domain glossary and any ADRs in the area you're touching first.

Then spawn a sub-agent to walk the codebase, starting from the code map if the project has one. Don't follow rigid heuristics; explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow**, with an interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

### 2. Present candidates as an HTML report

Write one self-contained HTML file following [HTML-REPORT.md](HTML-REPORT.md) to the OS temp directory, so nothing lands in the repo, as `architecture-review-<timestamp>.html` so each run gets a fresh file. Write it in the language the user asks for, else English. Open it for the user and tell them the absolute path.

Each candidate gets a card with a before/after diagram; the report ends with the top recommendation.

**Name things with the glossary's vocabulary for the domain and the deep-module vocabulary for the architecture.** If the glossary defines "Order," talk about "the Order intake module," not "the FooBarHandler," and not "the Order service."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly in the card (e.g. a warning callout: _"contradicts ADR-0007, but worth reopening because…"_). Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. After the file is written, ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, use `grilling` to walk the decision tree with them: constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize:

- **New or sharpened domain terms**: keep the glossary current with `domain-modeling`.
- **The code map turned out wrong** about an area you explored: offer to fix it.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing; skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** Use the design-it-twice pattern from `designing-deep-modules`.

When the design is settled, offer the next step: implement it now, `handoff` or turn it into a spec or tickets.
