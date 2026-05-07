#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyCitation } from './remark-resolve-citations.mjs';

const ROOTS = ['src/content', 'src/pages'];
const CITATION_REGEX = /\s*\[CITATION:([^\]]*)\]/g;
const INLINE_CODE_CITATION_REGEX = /`\s*\[CITATION:([^\]]*)\]\s*`/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

function replacementFor(citationText) {
  const resolved = classifyCitation(citationText.trim());
  return resolved ? ` ([${resolved.label}](${resolved.url}))` : '';
}

function resolveCitations(source) {
  return source
    .replace(INLINE_CODE_CITATION_REGEX, (_match, citationText) => replacementFor(citationText).trim())
    .replace(CITATION_REGEX, (_match, citationText) => replacementFor(citationText));
}

let changed = 0;
let remaining = 0;

for (const root of ROOTS) {
  for (const file of await walk(root)) {
    const before = await readFile(file, 'utf8');
    const after = resolveCitations(before);
    if (after !== before) {
      await writeFile(file, after, 'utf8');
      changed += 1;
    }
    if (after.includes('[CITATION:')) remaining += 1;
  }
}

console.log(`resolved citations in ${changed} files`);
console.log(`files with remaining citation markers: ${remaining}`);
