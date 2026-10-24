---
name: using-personal-context
description: "Find a project's working context before asking me: issue tracker, labels, git provider, glossary, where docs go, conventions. Reads the committed files, then my private context folder. Use whenever a task needs one of these and the prompt doesn't give it."
---

Look it up in this order, and stop at the first that answers:

1. The prompt.
2. Committed files: `CLAUDE.md` or `AGENTS.md`, a glossary (`GLOSSARY.md`, or `CONTEXT.md` in older repos), coding standards (`CODING_STYLE.md`…), `README`, `CONTRIBUTING`, `docs/`.
3. The personal context folder at the repository root: the one my instructions name, else `.my-context/`. Read its `README.md` and follow its pointers into the committed files. What it states itself is private: use it, but never mention the folder in anything committed or shared.
4. The repository itself: the remote, `git log`, branch names. Tell me what you inferred.

Still missing: ask me. If the folder doesn't exist and the question will come up again, suggest `setup-personal-context`.
