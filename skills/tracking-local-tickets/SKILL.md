---
name: tracking-local-tickets
description: "Keep tickets as Markdown files in the repository instead of a remote issue tracker, private or committed. Use when I ask for local tickets, when the project's tracker is local, or when a skill must create, read or update a ticket locally."
---

Local tickets live in the repository as Markdown files. Use them when the project's tracker is local, or when I ask for them: for a one-off, or for work I don't want in the team's tracker.

## Where

- **The project's tracker is local** (per the project context): its committed folder, else `.scratch/` at the repository root.
- **I ask for local tickets**: private by default, in `tickets/` in my personal context folder. Committed when I say so, in the folder the project context names, else `.scratch/`.

Inside, one folder per project: `<project-slug>/`, with an optional `spec.md` and one file per ticket, `<NNN>-<slug>.md`, numbered from `001` in dependency order. Create folders on the first write.

## A ticket file

```md
# 001: <title>

Status: todo
Blocked by: 002, 003
Parent: 004
Labels: …

<body, following ticket-conventions>

## Comments

<appended, newest last>
```

`Blocked by`, `Parent` (groups the ticket under another) and `Labels` are optional: drop the line when empty.

## Operations

- **Create**: the next free number in the project folder.
- **Read**: the file at the path or number I give, comments included.
- **Comment**: append under `## Comments`.
- **Update status**: rewrite the `Status:` line: todo, in progress, in review, done.
- **Frontier**: the open tickets whose blockers are all done, lowest number first.
