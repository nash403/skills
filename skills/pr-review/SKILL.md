---
name: pr-review
description: Tell me whether to approve a PR/MR, or draft the review threads I should post.
argument-hint: "<PR/MR URL>"
disable-model-invocation: true
---

Tell me whether I should approve this Pull Request / Merge Request. Read its title, description, linked issue and existing threads, then check against the code that it does what it claims, that its tests cover the acceptance criteria (stated or inferred) and test what their names say, that it follows the repo's and the stack's guidelines, and that it adds no comment slop (see `cleanup-comments`).

If not, draft the review threads following `writing-review-comments`, each anchored to its code. Post nothing until I say so.
