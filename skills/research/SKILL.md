---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it to the first destination that applies, and say where:
   1. Where the user requested the output.
   2. The current project's dedicated place for research findings, if it has one. Match its existing convention.
   3. The temporary directory of the user's OS, not the current workspace.
4. If the environment can't write to a file system the user can reach (e.g. a remote sandbox), output the full findings in the chat response, before the agent's summary.
