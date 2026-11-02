---
name: pr-review
description: Review a PR/MR's code, then give me a verdict on whether to approve it and draft the review threads worth posting.
argument-hint: "<PR/MR URL>"
disable-model-invocation: true
---

Review this Pull Request / Merge Request, then give me your verdict on whether to approve it. Read its title, description, linked issue and existing threads. Work from a worktree on its branch, so the code you read is the PR's, not my working copy, and read the callers and surrounding code the diff touches. Review its changes against the repo's and the stack's coding standards and against the linked issue, else its description. Verify each finding against the code before keeping it.

On top of that, check that the PR:

- does what its description claims;
- has tests that cover the acceptance criteria (stated or inferred), with at least one happy path and one edge or negative case per changed behavior;
- has tests that test what their names say;
- adds no comment slop (see `cleanup-comments`);
- has displayed text that uses the same words as the rest of the app, in every language, with no new synonym for an existing term, and says something true and unambiguous where it appears. If the app has i18n, flag any hardcoded text.

Then try to break it: hunt for flaws or inconsistencies in its logic, UX gaps, and use cases the implementation doesn't handle. Keep at most 3.

I am not always familiar with the subject of the change, so start with a short recap of what it does.

Your verdict is advice; I decide. Whatever it is, draft a review thread for each point worth raising, each anchored to its code. Skip any point an existing thread already raises, unless you can take its reasoning further: then draft a reply in that thread instead. Mark nitpicks as nits. Above each draft, explain the problem to me briefly, with a concrete example when one exists, so I can judge it myself. When something doesn't work, give me in simple words the current versus the expected behavior and, if it's complex, how to reproduce it and the likely root cause. Post nothing until I say so.

Keep the output short and easy to review: the recap, the verdict, the drafts. Leave out what you checked and found fine.
