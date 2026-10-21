---
name: writing-review-comments
description: "How to write and post review comments and replies on a PR/MR: anchoring, one thread per concern, length, tone, language, resolving. Use before posting any review comment or reply, on any platform."
---

Among the tools available, prefer the one that can anchor a comment to a file and line: check its parameters for a path/line pair. Use it whenever the finding sits at a location. A tool that only posts a plain comment is for what has no location: overall verdict, cross-file concerns. One thread per concern: replies and resolution track per thread, so five points bundled into one comment resolve as one.

Verify every claim against the code before posting. A confident wrong finding costs the author more than silence.

Length is proportional to how hard the change is to understand, nothing else. One sentence for an obvious fix. Finding, why it matters, stop, for a non-obvious one. Longer only when a failure path needs walking through. Cut praise, hedging, restatements of the diff, what you checked, and any summary of your own comment.

Reach for a suggestion block when the fix is a literal edit, a code block when quoting the offending lines is what lands the point, a table when concrete values need comparing. Otherwise prose, and any other formatting only when it passes the same test.

Write like you would speak to the author: friendly, direct, about the code and never their judgement. Flag a nitpick as a nitpick and say when you might be wrong. Language: the one I ask for, else the one that dominates the thread or the MR's comments, else English.

To close a thread, verify the fix in the code silently, then resolve with no reply. Reply only to carry something forward: a remaining request, a new finding, an answer they asked for. Then resolve if settled, leave open if not.
