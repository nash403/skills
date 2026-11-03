# nash403 skills

My personal agent skills, published from the same files as a Claude Code plugin and through skills.sh.

## Language

### Skills

**Skill**:
A folder under `skills/` holding a `SKILL.md`; the folder name is the skill's name.
_Avoid_: prompt, rule

**Published skill**:
A skill committed to the repository, hence public and installable by anyone.

**Draft skill**:
A skill that exists only in the working copy, untracked, so no install can see it.
_Avoid_: WIP skill, private skill

**User-invoked skill**:
A skill only the user can trigger, by name; the agent never loads it on its own.
_Avoid_: command, slash command

**Cross-skill reference**:
A skill naming another skill for the agent to load. It works only when both are installed.

### Distribution

**Plugin**:
`nash403-skills`, the Claude Code bundle of every published skill plus the hooks, updated by releases.

**Marketplace**:
`nash403`, the catalog Claude Code reads to find the plugin.

**skills.sh install**:
Published skills copied as editable files into someone's project, read straight from `main`, without hooks.

**Release**:
A new plugin version, cut on demand. Plugin installs update on it; skills.sh installs ignore it.

**Hook**:
A plugin-only script that nudges the agent toward a skill or gates an action. The judging stays in the skill, so skills still work without it.

### Project context

**Project context**:
What skills need to know about a project to work in it: issue tracker, labels, git provider, glossary, where docs go, conventions. Found in the prompt, the committed files, the personal context folder, then the repository itself.
_Avoid_: working context

**Personal context folder**:
The user's uncommitted folder at a repository root, `.my-context/` by default, pointing skills to the project context plus what only the user needs. Never mentioned in anything committed or shared.
_Avoid_: private context folder

### Artifacts

What skills produce and hand to each other.

**Ticket**:
Any tracked work item: issue, story, bug or task.
_Avoid_: issue, card

**Spec**:
The user stories (or tasks) that reach one goal, plus the decisions they share.
_Avoid_: epic

**PRD**:
A product requirements document: the why, the what, and how success is measured, never the how.
_Avoid_: product spec, requirements doc

**RFC**:
A design proposal put up for discussion before a decision is made.
_Avoid_: design doc

**ADR**:
An architecture decision record: one decision taken, with its context and its reason.

**Glossary**:
A project's canonical vocabulary, one definition per term, free of implementation details.
_Avoid_: context file

**Code map**:
A project's navigation guide: what each area of the code is for and where to change what.

**Docs map**:
The index of which doc owns which topic, so every piece of documentation has one home.

**Handoff document**:
A summary of a session that lets a fresh agent pick up the work.
_Avoid_: handover, session notes

**Prototype**:
Throwaway code built to answer one design question, deleted once answered.
