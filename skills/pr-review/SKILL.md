---
name: pr-review
description: Tell me whether to approve a PR/MR, or draft the review threads I should post.
argument-hint: "<PR/MR URL>"
disable-model-invocation: true
---

Tell me whether I should approve this Pull Request / Merge Request. Read its title, description, linked issue and existing threads, then the diff along with the callers and surrounding code it touches. Review the code and check that:

- it does what it claims;
- its tests cover the acceptance criteria (stated or inferred), with at least one happy path and one edge or negative case per changed behavior;
- its tests test what their names say;
- it follows the repo's and the stack's guidelines;
- it adds no comment slop (see `cleanup-comments`);
- its displayed text uses the same words as the rest of the app, in every language, with no new synonym for an existing term, and says something true and unambiguous where it appears. If the app has i18n, flag any hardcoded text.

Then try to break it: hunt for flaws or inconsistencies in its logic, UX gaps, and use cases the implementation doesn't handle. Keep at most 3.

I am not always familiar with the subject of the change, so start with a short recap of what it does.

Your verdict is advice; I decide. Whatever it is, draft a review thread for each point worth raising, following `writing-review-comments`, each anchored to its code. Skip any point an existing thread already raises, unless you can take its reasoning further: then draft a reply in that thread instead. Mark nitpicks as nits. Above each draft, explain the problem to me briefly, with a concrete example when one exists, so I can judge it myself. When something doesn't work, give me the current versus the expected behavior and, if it's complex, how to reproduce it and the likely root cause. Post nothing until I say so.

Keep the output short and easy to review: the recap, the verdict, the drafts. Leave out what you checked and found fine.
