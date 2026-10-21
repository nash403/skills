#!/usr/bin/env node
// Checks that every skill's SKILL.md starts with a YAML frontmatter that a
// strict parser accepts (GitHub, Claude Code, skills.sh), with a `name` that
// matches its folder and a non-empty `description`.
// Usage: node scripts/validate-skills.mjs [skills/<name>/SKILL.md ...]
// Without arguments, checks every skills/*/SKILL.md.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parseDocument } from "yaml";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync("skills", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join("skills", entry.name, "SKILL.md"))
      .filter((file) => existsSync(file));

function check(file) {
  const errors = [];
  const source = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) return ["no frontmatter: the file must start with a --- block closed by ---"];

  const doc = parseDocument(match[1], { strict: true, uniqueKeys: true });
  for (const issue of [...doc.errors, ...doc.warnings]) {
    errors.push(`invalid YAML: ${issue.message.split("\n")[0]}`);
  }
  if (errors.length) return errors;

  const data = doc.toJS();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["frontmatter must be a mapping of keys to values"];
  }

  const folder = basename(dirname(file));
  if (typeof data.name !== "string") errors.push("missing `name`");
  else {
    if (data.name !== folder) errors.push(`name "${data.name}" doesn't match folder "${folder}"`);
    if (!NAME_RE.test(data.name) || data.name.length > 64) {
      errors.push("name must be kebab-case, 64 characters max");
    }
  }

  if (typeof data.description !== "string" || !data.description.trim()) {
    errors.push("missing or empty `description`");
  } else if (data.description.length > 1024) {
    errors.push(`description is ${data.description.length} characters, 1024 max`);
  }

  return errors;
}

let failed = 0;
for (const file of files) {
  const errors = check(file);
  if (!errors.length) continue;
  failed++;
  console.error(`✘ ${file}`);
  for (const error of errors) console.error(`  - ${error}`);
}

if (failed) {
  console.error(`\n${failed} of ${files.length} skills have an invalid frontmatter.`);
  process.exit(1);
}
console.log(`✔ ${files.length} skills have a valid frontmatter.`);
