---
name: setup-home-repo
description: "Set up a Home Repo: one git repo for a group of related repos (one domain, all my work projects, every repo on my machine…) holding the private skills, the wiki and the tooling they share, with an AGENTS.md that points at each of them. I run my agent from it. Use when I ask to set up, create or extend a home repo."
disable-model-invocation: true
argument-hint: "Which repos it groups, and optionally its name, where it lives and where to search for repos"
---

# Setup home repo

A **Home Repo** holds what a group of related repos share and none of them owns: private skills, a wiki that grows session after session, tooling that acts on the repos. Its AGENTS.md points at each **child repo**. I may keep one per group.

## How to work

- Put every decision to me in `grilling` rounds; look up every fact yourself (filesystem, git, `gh` or `glab`).
- Read only until I approve the plan. Leave `.env` and other secret files unread.
- If the Home Repo exists, update it: inventory only what its AGENTS.md doesn't cover yet.

## 1. Scope

From my prompt, deduce the group, the search area (`~` unless I named a folder) and the name: mine with a `-wiki` suffix, `home-repo-wiki` if I gave none. Done when I've confirmed the search area and the name.

## 2. Repos

Find every git repo in the search area, skipping dependency and cache folders; fold worktrees and submodules into their main repo. Record each one's path, remote, visibility, last commit date, and any other Home Repo already pointing at it.

Ask:

1. which repos are child repos: recommend those matching the group, most recent first;
2. where the Home Repo lives: the folder I named, else the closest common parent of the child repos;
3. new or existing repo: recommend new and private;
4. personal or shared with a team: recommend personal;
5. which file my harness loads at session start (`AGENTS.md`, `CLAUDE.md` or both): recommend what my setup shows.

Done when every repo is marked in or out and the rest is answered.

## 3. Structure

Propose the tree for my harness, e.g. for Claude Code:

```
<name>/
├── AGENTS.md              intro, where things go, Other Repos
├── CLAUDE.md              `@AGENTS.md`
├── .claude/skills/        private skills (`.agents/skills/` for other harnesses)
├── .claude/settings.json  child repos outside the Home Repo, in `permissions.additionalDirectories`
├── wiki/                  Markdown docs, indexed by `wiki/README.md`
└── tooling/               scripts acting on the child repos
```

Done when I approve the tree.

## 4. Shared material

In the child repos and my user-level skill folders, list every skill, `AGENTS.md`, `CLAUDE.md`, agent doc (coding standards, glossaries, ADRs) and cross-repo script. Put each in one bucket:

- **shared** across the child repos;
- **duplicate**: diff the copies, mark the newest;
- **repo-specific**: about one repo;
- **machine-wide**: user-level, useful beyond the group;
- **installed**: from a skills repo, plugin or marketplace.

Done when every item has one bucket.

## 5. Plan

Show a table: each item, where it is, where it goes. Shared and duplicate items move to the Home Repo, one copy, the newest; the rest stay.

Under it, show the AGENTS.md:

```markdown
# <name>

<The group these repos form.>

## Where things go

- Skills for these repos only: `<skills folder>/`.
- What we learn about them: a page in `wiki/`, listed in `wiki/README.md`.
- Scripts acting on them: `tooling/`.

## Other Repos

- <name> (<what it is>): <local path>. Clone from <remote> if missing.
```

Add a hint where a repo needs one ("read its AGENTS.md first"). Past about 20 repos, point at one file per area under `wiki/repos/` instead. Done when I approve the table and the AGENTS.md.

## 6. Apply

1. Create the Home Repo with the approved tree and AGENTS.md.
2. Copy each shared item in, skill folders whole.
3. Remove the moved copies: in child repos on a new local branch, in user-level folders only for rows I approved.
4. Commit in the Home Repo. Remote and push are my call.

Done when every row is applied. Report each row's outcome, the branches created, the references left dangling, and anything skipped, with the reason.

## 7. Personal context

Skip if the Home Repo is shared with a team. List the child repos without a personal context folder and ask which ones get one. Run `setup-personal-context` in each chosen repo, one at a time; the folder lives in that repo, never in the Home Repo, and nothing in the Home Repo mentions it. Done when each chosen repo has its folder, or I stop.
