---
name: find-frictions
description: On manual invocation, review the current chat session for friction points and propose 1–3 high-value fixes if any (create/update a skill, or a doc note).
disable-model-invocation: true
---

Scan the conversation for friction: errors I flagged or asked to correct, rework, the
same clarification repeated, or a wrong assumption that caused a detour. Ignore whatever
went smoothly.

For each one, ask what generalizable instruction was missing from a workflow and how
likely it is to recur. Keep only friction that is both generalizable and likely to happen
again under similar circumstances. Discard one-offs, trivial corrections, preferences, and
anything an existing skill or doc already covers — exit workflow with zero suggestions is
the preferred outcome when nothing qualifies.

Cap at 1–3 fixes, each one of: create/update a skill, or create/update a doc note. Avoid
overkill and no-impact ideas; each must remove a concrete, recurring class of friction.
Print a short summary of the suggestions inline. When I explicitly confirm I want to
apply a suggestion invoke the `handoff` skill to package them into a handoff document
a fresh session can execute — each entry stating the friction it removes (one line of
session evidence) and the concrete change.
