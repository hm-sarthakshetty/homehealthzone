#!/usr/bin/env node
/**
 * One-off migration: copy legacy text prices (price_current / price_mrp, INR)
 * into the numeric per-country map `prices.IN` for every product and
 * cpap-bipap JSON record.
 *
 * - Legacy fields are left untouched so existing templates keep working.
 * - Records without a parsable price_current get no prices.IN entry.
 * - Existing prices.* entries for other countries are preserved.
 * - Idempotent: re-running produces no diff.
 *
 * Usage: node scripts/migrate-prices-to-map.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIRS = ['src/content/products', 'src/content/cpap-bipap'];
const dryRun = process.argv.includes('--dry-run');

function parsePrice(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const indent = (json) => json.replace(/\n/g, '\n  ');

let changed = 0;
let skipped = 0;
for (const dir of DIRS) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const path = join(dir, file);
    const before = readFileSync(path, 'utf8');
    const data = JSON.parse(before);
    const amount = parsePrice(data.price_current);
    if (amount === null || (data.price_symbol && data.price_symbol !== '₹')) {
      skipped++;
      continue;
    }
    const entry = { amount, currency: 'INR' };
    const mrp = parsePrice(data.price_mrp);
    if (mrp !== null) entry.mrp = mrp;

    if (data.prices?.IN?.amount === amount && (data.prices.IN.mrp ?? null) === mrp) {
      continue; // already migrated
    }
    if (data.prices) {
      // Map already present (e.g. US entry added by hand): merge and re-serialise
      // only that block, leaving the rest of the file's formatting intact.
      const merged = { ...data.prices, IN: { ...(data.prices.IN ?? {}), ...entry } };
      const after = before.replace(/\n  "prices": \{[\s\S]*?\n  \},?\n/, (m) =>
        `\n  "prices": ${indent(JSON.stringify(merged, null, 2))}${m.trimEnd().endsWith(',') ? ',' : ''}\n`);
      if (after !== before) { changed++; if (!dryRun) writeFileSync(path, after); }
      continue;
    }
    // Insert textually after the "price_symbol" line so numeric formatting,
    // key order and escapes in the rest of the file are untouched.
    const block = `  "prices": ${indent(JSON.stringify({ IN: entry }, null, 2))},\n`;
    const after = before.replace(/(\n  "price_symbol": [^\n]*,\n)/, `$1${block}`);
    if (after === before) {
      console.warn(`no price_symbol line in ${path}; skipped`);
      skipped++;
      continue;
    }
    if (after !== before) {
      changed++;
      if (!dryRun) writeFileSync(path, after);
    }
  }
}
console.log(`${dryRun ? '[dry-run] ' : ''}updated ${changed} file(s); ${skipped} without a parsable INR price`);
