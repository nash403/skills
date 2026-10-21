---
name: wizard
description: "Generate an interactive wizard that walks a human through steps only they can perform, or collects answers only they hold: a bash script for the terminal, or a single HTML form page to send to anyone. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, running a one-off migration or cutover, or gathering setup details from someone else. Don't invoke this for steps the agent can perform itself."
---

# Wizard

A **wizard** walks a human, step by step, through a manual procedure that's tedious to do by hand and tedious to re-explain to an AI every time. It says exactly where to go and what to copy, captures the values, and gets them where they belong (`.env`, GitHub secrets). It might configure third-party services, run a one-off migration, or move the project from one state to another.

It comes in two modes, each with a template whose library is identical in every wizard: never hand-edit it. **Your job is only to scope the procedure and author its stages.**

- **CLI**: a bash script, for me in a terminal. It writes `.env` and GitHub secrets itself and confirms irreversible actions. See [CLI.md](CLI.md).
- **UI**: a single self-contained HTML page, for anyone, developer or not, with a browser. It collects and exports the answers: it can't write files or secrets, so it hands back a prompt that tells an agent where each value goes. Secrets are encrypted in the page. See [UI.md](UI.md).

Pick CLI when I'm the one running it and something must be written or run on this machine. Pick UI when someone else fills it in, or when it's mostly questions. Ask if it isn't obvious.

A wizard is ephemeral by default: built for one run, deleted when the job's done. Commit it only when I want a repeatable setup path that should live in the repo.

## Process

### 1. Scope the procedure

Work out every manual step the human must take and every value that gets captured along the way. Read the repo first, don't ask cold:

- For setup: `.env`, `.env.example`, `.env.*`, `README`, `docker-compose*`, framework config, and `.github/workflows/*` (every `secrets.*` / `vars.*` reference is a value the wizard must produce).
- For a migration or transition: the current state, the target state, and the irreversible actions between them.

Then show me the ordered list of stages and the values each produces, and confirm: I may add, drop, or reorder.

**Done when:** every stage is named in order, and for each captured value you know (a) where the human gets it, (b) where it's written (`.env`, a GitHub secret, both, or nowhere; some stages are pure actions), and (c) whether it's secret or public.

### 2. Map each stage's journey

For each stage, write the precise path a human follows: which URL to open, what to do there, where a value is shown, which variable it fills: e.g. "Dashboard → Developers → API keys → Reveal test key → copy". Where you don't actually know the current UI or the exact command, say so and ask me or check the docs: never invent steps that may not exist.

**Done when:** every stage traces to concrete instructions a stranger could follow.

### 3. Author and hand off

Follow the mode's file: [CLI.md](CLI.md) or [UI.md](UI.md).
