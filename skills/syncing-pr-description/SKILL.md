---
name: syncing-pr-description
description: "Keep a PR or MR description true to its changes: compare it with the branch diff and update it when it drifted. Use before pushing to a branch with an open PR or MR, when a push is blocked because its description wasn't checked, or when I ask to check one."
---

1. **Find the open PR or MR** of the branch. None, or a draft: nothing to do.
2. **Compare** its description with the changes against its target branch: `git diff origin/<target>...HEAD`.
3. **Still accurate**: say so in one line. **Drifted**: draft the update, then show me only the passages that change, before and after, with a one-line reason. Wait for my go.
4. **Apply.** If a push was blocked, run the validation command its message gave: `--unchanged`, or `--description-file` with the approved text, which also updates the platform. Then retry the push. Otherwise update it on the platform directly.
