# Skills

My personal skills that I use every day to do engineering on my personal and professional projects.

These skills are designed to be small, easy to adapt, and composable. Hack around with them. They work with any model. Make them your own. Enjoy.

## Installation (30-second setup)

Two ways in, two philosophies. **The [Claude Code plugin](https://code.claude.com/docs/en/plugins)** installs the whole set as a managed, read-only bundle that updates when I ship, so you subscribe rather than fork. **[skills.sh](https://skills.sh/nash403/skills)** copies editable skill files into your project, so you can hack on them and make them your own. Pick one: installing both leaves you with every skill twice.

### 1. Get the skills

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugins install nash403-skills
```

Or, from inside a session:

```
/plugin install nash403-skills
```

It's in Claude Code's official marketplace, so there's nothing to add first, and updates arrive automatically.

</details>

<details>
<summary><strong>Codex, and other agents</strong></summary>

```bash
npx skills@latest add nash403/skills
```

Pick the skills you want, and which coding agents to install them on. **The installer lets you choose which skills to take.**

</details>

<details>
<summary><strong>For tinkerers</strong></summary>

Use the same installer, on any agent, including Claude Code:

```bash
npx skills@latest add nash403/skills
```

It writes the skills into your repo as ordinary files you own and can edit. Nothing updates behind your back; pull my latest changes when you want them with `npx skills update`.

</details>

### 2. Bam - you're ready to go.
