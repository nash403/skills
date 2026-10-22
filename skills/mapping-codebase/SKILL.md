---
name: mapping-codebase
description: "Create or update a project's code map: what each area of the repo is for and where to change what, so agents navigate without re-exploring. Use when I ask for a code map, or after changes that add, move or remove areas of the code."
---

The code map is a short navigation guide: what each area is for, where it starts, and where to change what. Navigation only: no tech stack copied from the manifests, no implementation details, no file-by-file listing.

## The map

First find the one the project already has, whatever its name (`CODEMAP.md`…): through `CLAUDE.md` or `AGENTS.md`, at the root, in `docs/`, then the project context. When there's none, the default is `CODE-MAP.md` at the root. On creation, point to it from `CLAUDE.md` or `AGENTS.md` in one line, and from the docs map if there is one.

A large package may own a map in its folder: the root map points to it instead of detailing it.

## Create

Dispatch a sub-agent to explore, so the main context stays light: the tree without dependencies and build output, the manifests and their scripts, the entry points, each area's responsibility. It returns findings, not file contents. Then write:

- what the project is, in one or two sentences;
- the areas: `Path | What it's for | Entry points`;
- the conventions that decide where things go (feature folders, colocated tests…), only when the names don't make them obvious;
- `I want to… | Look in…` for the common changes.

## Update

Start from the footer's SHA: `git diff --name-status <sha>..HEAD` lists what was added, removed or renamed since. Update only the areas it touches: a new area gets a row, a removed one leaves, a rename fixes its paths. Then check every path in the map still exists. No SHA, or it's unknown to git: redo the exploration with a sub-agent.

## Footer

End the map with `_Last updated <YYYY-MM-DD HH:MM>, at <short SHA of HEAD>._`, refreshed on every create or update.

Keep it scannable in a minute: a section that takes longer is too detailed.
