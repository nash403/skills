---
name: post-mortem-this-session
description: When asked, narrate the current session's work as a plain-language TL;DR and flag drift from the user's latest stated intent.
disable-model-invocation: true
---

Retell what happened in the conversation, step by step, in order. Write for someone who
wasn't watching: plain language, no jargon, no tool names, no internal mechanics. Say
what was tried, what changed, what broke, what got redone. Keep it a TL;DR, a few
sentences per step, not a transcript.

Identify the user's most recently stated intent, the latest ask, not an earlier version
superseded since. As you narrate, wherever the current state no longer matches that
intent, **bold** the drifted part inline, where it comes up, not in a separate list.

If nothing has drifted, say so at the end. Output goes straight in the chat reply; don't
create a file unless asked.
