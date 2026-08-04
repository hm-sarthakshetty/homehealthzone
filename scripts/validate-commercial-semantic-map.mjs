#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const csvPath = join(root, 'data', 'commercial-search-rewrite-map.csv');
const distPath = join(root, 'dist');

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

const lines = readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
const headers = parseCsvLine(lines.shift());
const rows = lines.map((line) =>
  Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? '']))
);

const failures = [];
if (rows.length !== 100) failures.push(`expected 100 rewrites; found ${rows.length}`);

const stopwords = new Set([
  'and', 'best', 'buy', 'buying', 'concentrator', 'cpap', 'bipap', 'current',
  'for', 'guide', 'home', 'india', 'machine', 'models', 'oxygen', 'price',
  'should', 'the', 'top', 'use', 'what', 'which', 'with', '2026',
]);

const ids = new Set();
const rewrites = new Set();
for (const row of rows) {
  if (ids.has(row.id)) failures.push(`duplicate id ${row.id}`);
  ids.add(row.id);
  const normalizedRewrite = row.likely_search_rewrite.toLowerCase();
  if (rewrites.has(normalizedRewrite)) failures.push(`duplicate rewrite: ${row.likely_search_rewrite}`);
  rewrites.add(normalizedRewrite);
  if (!row.target_url.startsWith('/') || !row.target_url.endsWith('/')) {
    failures.push(`invalid target URL for ${row.id}: ${row.target_url}`);
  }

  if (existsSync(distPath)) {
    const rendered = join(distPath, row.target_url, 'index.html');
    if (!existsSync(rendered)) {
      failures.push(`missing rendered target for ${row.id}: ${row.target_url}`);
    } else {
      const html = readFileSync(rendered, 'utf8').toLowerCase();
      const semanticTerms = row.likely_search_rewrite
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stopwords.has(term));
      const covered = semanticTerms.filter((term) => html.includes(term));
      const coverage = semanticTerms.length ? covered.length / semanticTerms.length : 1;
      if (coverage < 0.65) {
        const missing = semanticTerms.filter((term) => !html.includes(term));
        failures.push(
          `weak semantic coverage for ${row.id} (${Math.round(coverage * 100)}%): ${row.target_url}; missing ${missing.join('|')}`
        );
      }
    }
  }
}

const families = new Map();
for (const row of rows) families.set(row.family, (families.get(row.family) ?? 0) + 1);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${rows.length} unique commercial rewrites across ${families.size} families.`);
console.log(`Mapped to ${new Set(rows.map((row) => row.target_url)).size} canonical URLs.`);
for (const [family, count] of [...families.entries()].sort()) console.log(`- ${family}: ${count}`);
