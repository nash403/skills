---
name: setup-personal-context
description: "Set up my private context folder in a repository, new or existing: where its issue tracker, labels, git provider, glossary, docs and conventions are, as pointers into the committed files plus what only I need. Use when I ask to set up, refresh or fill in my personal context for a project."
---

# Setup personal context

The **personal context folder** sits at the repository root: `.my-context/`, unless my instructions name another; if they name none, ask, proposing that one. Its `README.md`, **the index**, tells my skills what they need about this repository that it doesn't say plainly. It's private: never committed, never mentioned in a committed file.

Committed files come first: the index mostly points to them.

## Process

### 1. Explore

Read before asking:

- the git remote, and the commit convention from recent `git log`;
- `CLAUDE.md` or `AGENTS.md`, `README`, `CONTRIBUTING`, `CONTEXT.md`, a glossary, a docs map and a code map whatever their names (`DOCS-MAP.md`, `CODEMAP.md`…), `docs/`, `docs/adr/`;
- PR or MR templates (`.github/`, `.gitlab/`);
- the tracker, from the instructions, ticket references in commits and branch names (`ABC-123`, `#12`). If you can reach it, read its teams, projects and labels;
- the existing index, when this is a rerun.

### 2. Draft, fact by fact

The facts: git provider and its CLI (`gh`, `glab`), issue tracker (with team and project, or local folder), its labels and what each is for, the ticket reference format, where the glossary, the docs map and the code map are, where each kind of document goes (context, ADR, spec, PRD, RFC), commit and PR or MR conventions, and anything I add.

For each one:

- **Already in a committed file**: write a pointer, e.g. `Issue tracker: CLAUDE.md § Agent skills`. Don't copy the value.
- **Missing, and useful to anyone on the project**: propose adding it to the right committed file, as a diff.
- **Missing, and only for me, or I want it private**: write it in the index.
- **Unknown**: ask me. Never guess.

Show me the whole draft, the index and any committed diff, and wait for my confirmation.

### 3. Write

- The index, one `##` section per fact.
- Add `/<folder>/` to `$(git rev-parse --git-common-dir)/info/exclude` if it's not there: it ignores the folder like `.gitignore` does, but is never committed and is shared by every worktree. Never touch `.gitignore` for this.
- The committed edits I approved. Don't commit them.

On a rerun, update in place: keep what I wrote by hand, and check every pointer still resolves.

### 4. Global instructions

My skills find the folder through my global agent instructions (`~/.claude/CLAUDE.md` for Claude Code). If they don't mention it, suggest adding this line, with the folder's name, and add it on my yes:

> My personal context folder is `.my-context/`, at the repository root. Before looking up a project's issue tracker, labels, git provider, docs or conventions, read its `README.md` if it exists.
