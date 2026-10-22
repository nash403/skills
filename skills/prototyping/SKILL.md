---
name: prototyping
description: "Build throwaway prototypes that answer a design question: whether a logic or state model holds up, or what a surface should look like or how it should behave, from a full page down to a single field. Use when I want to try options before building, can't picture how something would look or feel, or ask to prototype."
---

A prototype is throwaway code that answers one question. The question decides the shape.

## Pick a branch

- **Does this logic or state model hold up?** → [LOGIC.md](LOGIC.md): a single HTML file anyone can click through.
- **What should this look like, or how should it behave?** → [UI.md](UI.md): variants of a surface, switchable in the running app.

If it's ambiguous, ask me.

## Rules for both

1. **Throwaway and marked as such.** Put it next to what it prototypes, named so nobody mistakes it for production code. Follow the project's conventions; don't invent a new structure.
2. **Trivial to run.** No thinking required to start it. One install command at most, if it needs external dependencies.
3. **No persistence by default.** State lives in memory. If the question is about persistence, use a scratch DB, localStorage or a local file with a clear "PROTOTYPE, wipe me" name.
4. **Skip the polish.** No tests, no error handling beyond what keeps it running, no abstractions.
5. **State the question** at the top of the prototype, so the answer can be checked against it.
6. **Capture it when done.** Fold the validated decision into the real code, then capture the prototype itself as a primary source: ask me how to proceed with it (offer a handoff). Capture the answer too: the question it settled and the verdict. The main branch keeps only the validated decision; the prototype code never ships as is, it gets rewritten properly.
