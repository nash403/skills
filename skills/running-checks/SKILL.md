---
name: running-checks
description: "Which local checks to run and when: typecheck, lint, format and tests, scoped to what you touched, the full test suite only before pushing. Use before running any typecheck, lint, format or test command, and before committing, in any language or stack."
---

Check what you touched, not the whole repository. Go through the project's scripts when it has them, passing them the selection.

## Typecheck

It must pass before every commit: every commit compiles. Run it regularly while working, incrementally when the tool allows it (`tsc --noEmit`, `vue-tsc`), and in a monorepo on the touched packages only.

## Lint and format

On the touched files only (`eslint <files>`, `biome check <files>`, `ruff check <files>`). Autofix is fine on those files, never across the repository: it buries the diff under unrelated changes. Touched files are clean before every commit; errors already present elsewhere are reported, not fixed.

## Tests

Only those related to what you touched: the test files you changed, and those covering the source files you changed or their dependents. Use the runner's own targeting:

- Vitest: `vitest related --run <files>`
- Jest: `jest --findRelatedTests <files>`
- pytest: the test files or folders matching the touched modules
- Go: `go test` on the touched packages
- Anything else: the narrowest path or filter the runner offers.

Run the full suite only when the work is about to be pushed, and only if it's needed: CI doesn't run it, or the change reaches far (shared config, a dependency bump, a module used everywhere). Otherwise leave it to CI.

## Always

- Never start a tool in watch mode.
- Never bypass the pre-commit hooks (`--no-verify`) unless I explicitly ask.
