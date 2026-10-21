# Skills

My personal skills that I use every day to do engineering on my personal and professional projects.

These skills are designed to be small, easy to adapt, and composable. Hack around with them. They work with any model. Make them your own. Enjoy.

## 30-second Installation setup

Two ways in, two philosophies:

- **The [Claude Code plugin](https://code.claude.com/docs/en/plugins)** installs the whole set as a managed, read-only bundle that updates when I cut a release. You subscribe rather than fork. Claude Code only.
- **[skills.sh](https://skills.sh/nash403/skills)** copies editable skill files into your project, for Claude Code, Codex, Cursor or any other agent that supports skills. You pick the skills you want, then hack on them and make them your own.

Pick one: installing both leaves you with every skill twice.
s
### 1. Get the skills

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugin marketplace add nash403/skills
claude plugin install nash403-skills@nash403
```

Or, from inside a session:

```
/plugin marketplace add nash403/skills
/plugin install nash403-skills@nash403
```

To get new versions automatically, turn on auto-update for the `nash403` marketplace in `/plugin`. Otherwise, run `claude plugin update nash403-skills`.

</details>

<details>
<summary><strong>skills.sh (any agent)</strong></summary>

```bash
npx skills@latest add nash403/skills
```

The installer asks which skills to take and which agents to install them on. It writes them into your project as ordinary files you own. Nothing updates behind your back: pull my latest changes when you want them with `npx skills@latest update`, and re-run `add` to pick up new skills.

</details>

### 2. Bam - you're ready to go.

## Recommended skills

Skills I recommend, maintained by their authors, and aren't part of this set. I use them regularly. Install each one on its own.

### herdr

[herdr](https://herdr.dev) is a terminal multiplexer for coding agents, a bit like tmux. Its skill lets your agent drive herdr: spawn panes, prompt other agents and wait on them. [Docs](https://herdr.dev/docs/agent-skill/).

```bash
npx skills@latest add herdrdev/herdr --skill herdr -g
```

### Dinero.js best practices

The official [Dinero.js](https://dinerojs.com) skill for handling money in JS environments: minor-unit amounts, no floats, immutability, allocation and scaled amounts. [Docs](https://dinerojs.com/agent-skills).

```bash
npx skills@latest add dinerojs/skills --skill dinero-best-practices
```

The same repo also has `dinero-formatting` and `dinero-currency-patterns`. Drop `--skill` to pick from all three.

## Credits

Many of these skills started from ones I found around the web and reshaped to fit how I work. Most of them owe a lot to [Matt Pocock](https://github.com/mattpocock) and [his skills](https://github.com/mattpocock/skills). Thanks, Matt.
