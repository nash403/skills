---
name: pr-review
description: Tell me whether to approve a PR/MR, or draft the review threads I should post.
argument-hint: "<PR/MR URL>"
disable-model-invocation: true
---

Tell me whether I should approve this Pull Request / Merge Request. Read its title, description, linked issue and existing threads, then check against the code that it does what it claims, that its tests cover the acceptance criteria (stated or inferred) and test what their names say, that it follows the repo's and the stack's guidelines, and that it adds no comment slop (see `cleanup-comments`).

I am not always familiar with the subject of the change, so start with a short recap of what it does.

If I shouldn't approve it yet, draft the review threads following `writing-review-comments`, each anchored to its code. Above each draft, explain the problem to me in a sentence or two, with a concrete example when one exists, so I can judge it myself. Post nothing until I say so.
