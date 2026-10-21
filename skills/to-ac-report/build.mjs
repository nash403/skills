#!/usr/bin/env node
// Render a state-of-AC report from its data: node build.mjs <report.json> <out.html>
// Run it from the analysed repository's root, so every source path can be checked.
// Numbering, counts, slugs, escaping and the inlined stylesheet all happen here,
// so the agent only ever writes report.json.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node build.mjs <report.json> <out.html>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(input, 'utf8'));
const template = readFileSync(join(here, 'report-template.html'), 'utf8');
const css = readFileSync(join(here, 'design-system.css'), 'utf8');

const errors = [];

// The flag set lives in the template's script, so the legend, the rows and this check agree.
const bare = s => s.replace(/️/g, '');
const FLAGS = new Map([...template.matchAll(/\['(.+?)', '(\w+)', '/g)].map(([, emoji, key]) => [bare(emoji), { emoji, key }]));

const escape = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/\{/g, '&#123;');  // data never reads as a {{PLACEHOLDER}}
// Backticks become <code>, the only markup the prose fields accept.
const prose = s => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pad = n => String(n).padStart(2, '0');

function fill(html, values) {
  return html.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => (key in values ? values[key] : match));
}

function block(html, kind, name) {
  const open = `<!-- ${kind}:${name} -->`;
  const close = `<!-- /${kind}:${name} -->`;
  const start = html.indexOf(open);
  const end = html.indexOf(close);
  if (start < 0 || end < start) throw new Error(`template is missing its ${kind}:${name} block`);
  return { before: html.slice(0, start), body: html.slice(start + open.length, end), after: html.slice(end + close.length) };
}

function each(html, name, list, render) {
  const { before, body, after } = block(html, 'each', name);
  return before + list.map((item, i) => render(body, item, i)).join('') + after;
}

function when(html, name, keep) {
  const { before, body, after } = block(html, 'if', name);
  return before + (keep ? body : '') + after;
}

const target = data.target ?? {};
for (const key of ['name', 'path', 'description']) {
  if (!target[key]) errors.push(`target.${key} is missing`);
}
const zones = data.zones ?? [];
if (!zones.length) errors.push('zones is empty');

const tally = new Map();
let total = 0;

function criterion(body, ac, i, zone) {
  const where = `${zone.code}-${pad(i + 1)}`;
  if (!ac.text) errors.push(`${where}: text is missing`);
  const match = /^(.+):(\d+)$/.exec(ac.source ?? '');
  if (!match) {
    errors.push(`${where}: source "${ac.source ?? ''}" is not a repo-relative path:line`);
  } else if (!existsSync(match[1])) {
    errors.push(`${where}: ${match[1]} not found from ${process.cwd()} (abbreviated path, or not run from the repo root?)`);
  } else if (!statSync(match[1]).isFile()) {
    errors.push(`${where}: ${match[1]} is not a file`);
  } else {
    const lines = readFileSync(match[1], 'utf8').split('\n').length;
    if (+match[2] < 1 || +match[2] > lines) errors.push(`${where}: ${match[1]} has ${lines} lines, not ${match[2]}`);
  }
  const [, path = '', line = ''] = match ?? [];
  const flags = (ac.flags ?? []).map(flag => {
    const known = FLAGS.get(bare(flag));
    if (!known) errors.push(`${where}: unknown flag ${flag}`);
    return known;
  }).filter(Boolean);
  for (const { emoji } of flags) tally.set(emoji, (tally.get(emoji) ?? 0) + 1);
  total++;
  return fill(body, {
    AC_ID: where,
    FLAGS: flags.map(f => f.emoji).join(' '),
    FLAG_CHIPS: flags.map(f => `<span class="flag" data-k="${f.key}">${f.emoji}</span>`).join(''),
    AC_TEXT: prose(ac.text),
    AC_NOTE: prose(ac.notes),
    AC_PATH: escape(path),
    AC_LINE: line,
    AC_FILE: escape(basename(path)),
  });
}

let html = template;
html = each(html, 'access', data.access ?? [], (body, entry) => fill(body, {
  ENTRY_PATH: prose(entry.path),
  ENTRY_PREREQUISITES: prose(entry.prerequisites),
  ENTRY_NOTE: prose(entry.note),
}));
const features = data.features ?? [];
html = each(html, 'feature', features, (body, feature) => fill(body, { FEATURE: prose(feature) }));
html = when(html, 'features', features.length > 1);
html = each(html, 'zone', zones, (body, zone, i) => {
  if (!zone.code || !zone.name) errors.push(`zone ${i + 1}: code and name are required`);
  if (!zone.criteria?.length) errors.push(`zone ${zone.code ?? i + 1}: no criteria`);
  const rows = each(body, 'criterion', zone.criteria ?? [], (row, ac, j) => criterion(row, ac, j, zone));
  return fill(rows, { ZONE_SLUG: slug(zone.name ?? zone.code), ZONE_NUM: i + 1, ZONE_NAME: escape(zone.name) });
});

const generated = data.generated ?? new Date().toISOString().slice(0, 10);
html = fill(html, {
  LANG: escape(data.lang ?? 'en'),
  TARGET_NAME: escape(target.name),
  TARGET_DESCRIPTION: prose(target.description),
  TARGET_PATH: escape(target.path),
  AC_COUNT: total,
  ZONE_COUNT: zones.length,
  FILE_COUNT: data.filesRead ?? '—',
  GENERATED: escape(generated),
  // Reader marks are keyed by this id: a rebuild the same day keeps them.
  REPORT_ID: `${slug(target.path ?? target.name)}-${generated}`,
});
html = html.replace('<link rel="stylesheet" href="design-system.css">', () => `<style>\n${css}</style>`);
// The template's notes for maintainers, and the block markers, stay out of the report.
html = html.replace(/^(<!doctype html>\n)<!--[\s\S]*?-->\n/i, '$1').replace(/[ \t]*<!-- \/?(each|if):\w+ -->\n?/g, '');

const leftover = [...new Set(html.match(/\{\{[A-Z_]+\}\}/g) ?? [])];
if (leftover.length) errors.push(`unfilled placeholders: ${leftover.join(' ')}`);
if (/<link rel="stylesheet"/.test(html)) errors.push('a stylesheet link survived');

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

writeFileSync(output, html);
const breakdown = [...FLAGS.values()].filter(f => tally.has(f.emoji)).map(f => `${f.emoji} ${tally.get(f.emoji)}`).join(' · ');
console.log(`${output}\n${total} criteria, ${zones.length} zones${breakdown ? ` · ${breakdown}` : ''}`);
