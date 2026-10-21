---
name: addressing-feedback
description: "Triage feedback threads on my work and draft replies: PR/MR review, comments on a doc, an essay or any artifact, read from a platform or pasted. Use when I ask to read, go through or answer review threads or feedback."
---

Read every thread, whole: every message, not just the first. Keep the reading order.

For each thread:

- **Name it** with a short kebab-case id, two or three words that sum it up (`null-check-save`, `rename-helper`). Use it for the rest of the session, never a number.
- **Check the facts** against the work itself (code, diff, sources, the document). Never take a remark at face value: look for misreadings, missing context, and contradictions with other threads or with earlier decisions.
- **Classify it** in plain words: does it hold up, and what does it call for. For example "Valid, change needed", "Wrong, missing context", "Already fixed", "Question", "Nitpick", "Just a comment". Use whatever words fit, new ones included. Add its importance: high, medium or low.
- **Already answered** by someone: say who, and whether they're right.
- **Change needed**: suggest the fix, don't make it.
- **Worth a reply**: draft one, only once the facts are checked. Short, straight to the point, human voice. Language: the one I ask for, else the thread's, else English.
- **Can't verify a fact, or don't know how to fix it**: ask me directly instead of guessing.

Output one entry per thread, in reading order: id, classification, importance, what you checked and what it shows, the suggested fix and the draft reply when there is one. Then end with:

1. The threads that need no reply and can be resolved.
2. The changes to make, one line each: thread id, what to change and how. Ask me which ones I want you to make.
3. Your open questions.

Then stop. I review the drafts over one or more rounds. Post nothing until I say go, and when posting, leave threads open unless I ask to resolve them.
