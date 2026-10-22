---
name: mapping-doc-ownership
description: "Keep a project's docs map: which doc owns which topic, so every piece of documentation has one home and the others link to it. Use before adding, moving or splitting documentation, when content looks duplicated across docs, or when I ask to create or update the docs map."
---

Every topic has one owner doc; the others link to it. The docs map says which doc owns what, so you know where to write before writing.

## The map

First find the one the project already has, whatever its name: through `CLAUDE.md` or `AGENTS.md`, in `docs/`, then the project context. When there's none, the default is `DOCS-MAP.md` at the root, in the format of [DOCS-MAP-FORMAT.md](DOCS-MAP-FORMAT.md). Create it only once placement stops being obvious, or when I ask, and point to it from `CLAUDE.md` or `AGENTS.md` in one line.

A package or app with docs of its own may own a map in its folder: the root map points to it instead of listing its docs. Each topic lives in one map only. For a given file, the map that applies is the nearest one up the tree, then the root.

The map holds routing only: no guidance, no copied content.

## Before writing

1. **Route.** The topic has an owner: update that doc. None: extend the nearest owner. Create a new doc only when its scope is stable and the owner would get noisy, then add its row to the map and link it from a hub.
2. **Deduplicate.** The same content in two docs: one owner keeps it, the other links to it. Commands, ports and versions are checked against the code and live in one canonical place.
3. **Agent files route, docs own.** `CLAUDE.md`, `AGENTS.md`, skills and rules point to docs and never own a decision a doc owns. Docs never point to them as their source of truth.

## Keep it true

In the same change as the docs: a doc created, moved, renamed or deleted updates its row; every owner doc stays reachable from a hub; links are relative. Then update the footer with the date and the current `HEAD`.

To refresh a map, start from its footer's SHA: `git diff --name-status <sha>..HEAD -- '*.md'` lists the docs added, removed or renamed since. Check those, and that every path in the map still exists. No SHA: check the whole map.

## Stop and ask

Before changing a topic's owner, merging or splitting owner docs, or any change that would make existing guidance wrong.
