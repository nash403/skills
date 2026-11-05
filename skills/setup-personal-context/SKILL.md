---
name: setup-personal-context
description: "Set up my personal context folder in a repository, new or existing: where its issue tracker, labels, git provider, glossary, docs and conventions are, as pointers into the committed files plus what only I need. Use when I ask to set up, refresh or fill in my personal context for a project."
---

# Setup personal context

Each repository has its own **personal context folder**, listed in my global instructions; worktrees share their main checkout's. If this repository isn't listed, ask, proposing `.my-context/` at the main checkout's root. Its `README.md`, **the index**, tells my skills what they need about this repository that it doesn't say plainly. It's private: never committed, never mentioned in a committed file.

Committed files come first: the index mostly points to them.

## Process

### 1. Explore

Read before asking:

- the git remote, and the commit convention from recent `git log`;
- `CLAUDE.md` or `AGENTS.md`, `README`, `CONTRIBUTING`, coding standards (`CODING_STYLE.md`…), a glossary, a docs map and a code map whatever their names (`GLOSSARY.md` or `CONTEXT.md`, `DOCS-MAP.md`, `CODEMAP.md`…), `docs/`, `docs/adr/`;
- PR or MR templates (`.github/`, `.gitlab/`);
- the tracker, from the instructions, ticket references in commits and branch names (`ABC-123`, `#12`). If you can reach it, read its teams, projects and labels;
- the existing index, when this is a rerun.

### 2. Draft, fact by fact

The facts: git provider and its CLI (`gh`, `glab`), the command that pushes without running CI (or that there's none), issue tracker (with team and project, or local tickets and their folder), its labels and what each is for, the ticket reference format, where the glossary, the coding standards, the docs map and the code map are, where each kind of document goes (glossary, ADR, spec, PRD, RFC), commit and PR or MR conventions, and anything I add.

For each one:

- **Already in a committed file**: write a pointer, e.g. `Issue tracker: CLAUDE.md § Agent skills`. Don't copy the value.
- **Missing, and useful to anyone on the project**: propose adding it to the right committed file, as a diff.
- **Missing, and only for me, or I want it private**: write it in the index.
- **Unknown**: ask me. Never guess.

If I decline a committed diff, offer to write that fact in the index instead: some projects aren't mine to change for my own agent's sake. If I decline that too, leave the fact out everywhere.

Show me the whole draft, the index and any committed diff, and wait for my confirmation.

### 3. Write

- The index, one `##` section per fact.
- If the folder is inside the repository, add `/<folder>/` to `$(git rev-parse --git-common-dir)/info/exclude` if it's not there: it ignores the folder like `.gitignore` does, but is never committed and is shared by every worktree. Never touch `.gitignore` for this.
- The committed edits I approved. Don't commit them.

On a rerun, update in place: keep what I wrote by hand, and check every pointer still resolves.

### 4. Global instructions

My skills find the folder through my global agent instructions (`~/.claude/CLAUDE.md` for Claude Code). If this repository isn't listed there, suggest its entry, with absolute paths, and add it on my yes. If there's no list yet, suggest it whole:

> My personal context folders, by repository (a worktree uses its main checkout's). Before looking up a project's issue tracker, labels, git provider, docs or conventions, read the folder's `README.md`:
>
> - `~/work/acme`: `~/work/acme/.my-context/`
