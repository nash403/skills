---
name: to-spec
description: "Turn the current conversation, or the context I give, into a spec and publish it to the project issue tracker if requested: no interview, just synthesis of what we've already discussed."
disable-model-invocation: true
---

Turn the current conversation, or the context passed as input, into a spec. Do NOT interview me: synthesize what you already know.

The issue tracker and vocabulary should have been provided to you. If not, infer them or ask me, then wait for my confirmation.

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout, and respect any ADRs in the area you're touching.
2. Sketch the seams at which the feature will be tested. Prefer existing seams to new ones, and the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better: ideally one. Check with me that they match my expectations.
3. Write the spec following `writing-spec`, then output it or publish it to the issue tracker, as requested.
