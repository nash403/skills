---
name: bump-dependencies
description: "Bump a project's dependencies group by group, from the least risky to the riskiest, verifying each group before the next. Works with any language and package manager. Use when I ask to update, upgrade or bump dependencies."
disable-model-invocation: true
argument-hint: "Which packages, and how far: patch, minor or major"
---

Bump the dependencies in groups, never all at once.

1. **Scope.** Ask what I haven't said: which packages or workspace members, how far (patch, minor or major), the exceptions, and any group to keep for last.
2. **Plan.** List what's outdated within the scope and group it by risk and relatedness: types and tooling first, then test libraries, runtime dependencies, frameworks, and linters last. Judge risk by the ecosystem's versioning, not the number alone: a `0.x` minor can break, a Go major changes the import path, many Python packages don't follow semver. Show me the plan and wait for my go.
3. **Look ahead on risky groups.** Before a major or a framework bump, use `research` on the changelog and migration guide between the current and target versions, the known regressions and whether a later patch fixes them (target that patch), and the breaking changes that hit APIs the repo actually uses.
4. **Bump one group at a time.** Keep the manifest and the lockfile in sync, if there is one. Run the project's checks after each group, and move on only when they pass.
5. **On a break,** read the changelog before fixing. Fix it when it's scoped (a renamed API, a type error, a new lint rule); when it needs a config migration or a broad refactor, stop the group, say what the fix involves, and offer to do it now. If I decline: skip the group, with a handoff for the migration if I want one (what breaks, what the changelog and research said, the steps to finish the bump), or abort.
6. **Drop what became useless.** A companion package that only filled a gap (type stubs, polyfills, backports, shims) may be obsolete after the bump: remove it rather than bump it.
7. **Report:** each package old → new, the groups skipped and why, the source files changed beyond the manifests and why, and what's still outdated out of scope. Commit only if I ask.
