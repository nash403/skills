This repo holds my personal agent skills, published two ways from the same files: as the Claude Code plugin `nash403-skills` (marketplace `nash403`, see `.claude-plugin/`) and through skills.sh (`npx skills@latest add nash403/skills`).

## Layout

Skills are flat: one `skills/<name>/SKILL.md` per skill, with `name` (matching the folder) and `description` in its frontmatter. The plugin loads `skills/` by default, so `plugin.json` has no `skills` array.

`hooks/hooks.json` and its scripts ship with the plugin only: skills.sh installs skills, not hooks. A hook nudges; the judging stays in a skill, so a skills.sh install still works without it.

## Published means committed

Anything committed under `skills/` is public and installable. Skills that are still drafts stay untracked in the working copy. Never stage or commit a skill folder unless the user asks for that skill specifically, and never use `git add .` or `git add skills/`.

## Versioning

`.claude-plugin/plugin.json`'s `version` is the only version; installed plugins update when it changes. Never bump it by hand: releases are cut by the manual **Release** GitHub Action (`.github/workflows/release.yml`), which takes patch, minor or major, commits the new version to `main`, tags it `nash403-skills--v<version>`, and creates a GitHub Release. skills.sh installs ignore releases and read `main` directly.

## Checks

Run `pnpm validate` before committing a skill or touching either manifest. It checks every `SKILL.md` frontmatter with a strict YAML parser (`scripts/validate-skills.mjs`), then runs `claude plugin validate . --strict`. Quote any frontmatter value that contains `: `, or GitHub and other strict readers fail to parse it.

## Tooling

pnpm is the package manager.
