---
name: working-with-worktrees
description: Where to create git worktrees and how to bootstrap them. Use whenever the user asks to work in, create, or move a worktree.
---

## Location

All worktrees of a project live in a single folder named `<root folder name>.worktrees/`, sibling of the project root; referred to as the default project worktrees folder / directory or container.

```
# Example for a repo inside `~/work` directory:
~/work/foobar/                      # project root (main checkout)
~/work/foobar.worktrees/<name>/     # one folder per worktree
```

Never create worktrees inside the project root (e.g. `~/work/foobar/.claude/worktrees/`).

## Bootstrap after creation

Some config files that tools load may be gitignored, so a fresh worktree starts without them. Copy them from the root into the worktree root:

1. Candidates: `.env`, `.env.local`, `.env.*`, `.envrc`, `mise.toml`, `.mise.toml`, `.mise.local.toml`, `.mise.*.toml`, `.tool-versions`, `.nvmrc`, `.python-version`, `.node-version`, and every path listed in `$(git rev-parse --git-common-dir)/info/exclude` (local, private ignores).
2. Keep only those that exist in the root **and** are untracked or ignored (`git status --porcelain --ignored -- <file>` shows `??` or `!!`). Tracked ones are already in the worktree.
3. `cp -R <root>/<file> <worktree>/<file>` — never overwrite a file already present in the worktree.

Report which files were copied.
