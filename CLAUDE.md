This repo holds my personal agent skills, published two ways from the same files: as the Claude Code plugin `nash403-skills` (marketplace `nash403`, see `.claude-plugin/`) and through skills.sh (`npx skills@latest add nash403/skills`).

`GLOSSARY.md` holds the repo's vocabulary, including the artifacts skills pass to each other. Use its terms when writing a skill.

## Layout

Skills are flat: one `skills/<name>/SKILL.md` per skill, with `name` (matching the folder) and `description` in its frontmatter. The plugin loads `skills/` by default, so `plugin.json` has no `skills` array.

`hooks/` ships with the plugin only: skills.sh installs skills, not hooks. A hook nudges, gates or shows state; the judging stays in a skill, so a skills.sh install still works without it. Each hook has its own `hooks/<name>/` folder, in one of two kinds:

- A command hook is a script that `hooks.json` lists under `hooks`, tested by the folder's `test.sh`.
- A mod is TypeScript that Claude Code runs itself, to draw in its interface or hook its events. `hooks.json` names one module, `hooks/register.tsx`, which registers each mod's `hooks/<name>/register.tsx`. A mod's `$.state` values are declared under the plugin's key in `types/index.d.ts` (`types` in `plugin.json`), and its `*.test.tsx` runs through `claude plugin test .`.

Run `pnpm test:hooks` after touching either kind: it runs every `test.sh`, then `claude plugin test .`.

## Published means committed

Anything committed under `skills/` is public and installable. Skills that are still drafts stay untracked in the working copy. Never stage or commit a skill folder unless the user asks for that skill specifically, and never use `git add .` or `git add skills/`.

## Versioning

`.claude-plugin/plugin.json`'s `version` is the only version; installed plugins update when it changes. Never bump it by hand: releases are cut by the manual **Release** GitHub Action (`.github/workflows/release.yml`), which takes patch, minor or major, commits the new version to `main`, tags it `nash403-skills--v<version>`, and creates a GitHub Release. skills.sh installs ignore releases and read `main` directly.

## Checks

Run `pnpm validate` before committing a skill or touching either manifest. It checks every `SKILL.md` frontmatter with a strict YAML parser (`scripts/validate-skills.mjs`), then runs `claude plugin validate . --strict`. Quote any frontmatter value that contains `: `, or GitHub and other strict readers fail to parse it.

## Tooling

pnpm is the package manager.
