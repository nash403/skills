---
name: spawn-session
description: Hand the current work off to a new session that starts right away, and report how to find it again.
argument-hint: "A ready brief (a command, a prompt or a handoff document's path), or what the next session will be used for"
disable-model-invocation: true
---

The session starts from a **brief**. If I passed a ready one (a command such as `/wayfinder <map>`, a prompt, or a handoff document), or the conversation already points to one, use it as is. Write a handoff document with the `handoff` skill only when the next session needs this conversation's context. Save a brief that isn't a file yet to the temporary directory of my OS, so the commands below can read it. Give the session a short descriptive name. If the working tree has uncommitted changes, ask me whether to commit them first.

Launch the session with the first option that works:

1. A tool that starts a new session (in the Claude desktop app: `start_session`), with the brief.
2. The `claude` CLI, in a new tab of the terminal I'm using, found from `$TMUX` and `$TERM_PROGRAM` (e.g. `tmux new-window`, `wezterm cli spawn`, `osascript` for Apple Terminal or iTerm), running a script that first runs `unset $(env | sed -n 's/^\(CLAUDE[A-Z_]*\)=.*/\1/p')` (otherwise the new session inherits this one's variables and doesn't save its transcript), then `cd '<dir>' && claude --session-id '<uuid>' --name '<name>' -- "$(cat '<brief file>')"`. Generate the ID with `uuidgen`. Only if I asked for the background, run `claude --bg --name '<name>' -- "$(cat '<brief file>')"` instead, with no window: it ignores `--session-id` and prints a short ID, the start of the full one, which names the transcript file.
3. Otherwise, or when you can't tell my terminal, give me `sh <script>` to run myself.

Then stop editing files here, and give me every handle that applies: name, full session ID, `claude --resume <uuid>` and the folder to run it from, branch or worktree, link to the session, transcript path (`~/.claude/projects/<folder with / replaced by ->/<uuid>.jsonl`) and the brief's path.
