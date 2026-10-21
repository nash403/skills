---
name: running-tests
description: "Which tests to run and when: only those related to the files you touched, the full suite only before pushing. Use before running any test command, in any language or stack."
---

Run only the tests related to what you touched: the test files you changed, and those covering the source files you changed or their dependents. Go through the project's test script when it has one, passing it the selection, and use the runner's own targeting:

- Vitest: `vitest related --run <files>`
- Jest: `jest --findRelatedTests <files>`
- pytest: the test files or folders matching the touched modules
- Go: `go test` on the touched packages
- Anything else: the narrowest path or filter the runner offers.

Never start a runner in watch mode.

Run the full suite only when the work is about to be pushed, and only if it's needed: CI doesn't run it, or the change reaches far (shared config, a dependency bump, a module used everywhere). Otherwise leave it to CI.
