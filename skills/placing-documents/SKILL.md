---
name: placing-documents
description: Decide where to save a document or artifact you produce (ADR, notes, report, plan…) when the skill producing it doesn't set its location. Use before writing any such file.
---

Save the document to the first destination that applies:

1. Where the user asked for it in the prompt.
2. Where the project keeps that kind of document. From the repository root (the current directory outside a git repository), look for a written rule (`CLAUDE.md`, `AGENTS.md`, `README`, `docs/`) or an unwritten one: an existing folder that already holds documents of that kind. Follow it.
3. For an ADR: `docs/adr/`, git repository or not.
4. Outside a git repository: a suitable place in the current directory.
5. In a git repository: the temporary directory of the user's OS, not the workspace.

Always tell the user the path you saved it to.

If the environment can't write a file the user can reach (e.g. a remote sandbox), output the full document in the chat instead.
