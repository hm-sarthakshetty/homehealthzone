#!/usr/bin/env node
/**
 * IndexNow ping script — notifies Bing/Yandex/Seznam of fresh or changed URLs.
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs                       # pings every URL in sitemap-0.xml
 *   node scripts/indexnow-ping.mjs --changed             # only URLs whose file mtime changed in the last 24h
 *   node scripts/indexnow-ping.mjs https://homehealthzone.com/oxygen-concentrators/home-medix-5-lpm/
 *
 * Pre-deployment: running this locally has no effect because api.indexnow.org
 * only accepts pings for URLs that resolve publicly and are verified against
 * the key file. Post-deployment: hook into `npm run build` via:
 *
 *   "build": "astro build && node scripts/indexnow-ping.mjs --changed",
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const MANIFEST_PATH = join(ROOT, 'public', 'indexnow-key.json');
if (!existsSync(MANIFEST_PATH)) {
  console.error('[indexnow] Missing public/indexnow-key.json — generate the key file first.');
  process.exit(1);
}
const { key, keyLocation, host } = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

function urlsFromSitemap() {
  const p = join(ROOT, 'dist', 'sitemap-0.xml');
  if (!existsSync(p)) {
    console.error(`[indexnow] ${p} not found — run \`npm run build\` first.`);
    process.exit(1);
  }
  const xml = readFileSync(p, 'utf8');
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) urls.push(m[1]);
  return urls;
}

function filterChangedInLast24h(urls) {
  const DAY = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - DAY;

  const slugFromUrl = (url) => {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '').split('/').pop() || 'index';
  };

  const candidates = [
    'src/content/product-reviews',
    'src/content/cpap-bipap-reviews',
    'src/content/clinical',
    'src/content/guides',
    'src/content/comparison-writeups',
    'src/pages',
  ].map((d) => join(ROOT, d));

  // Build slug -> file-mtime map from every plausible source directory.
  // This is a superset — multiple candidate paths may contain the slug, so we take the latest.
  const mtimeBySlug = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.(mdx|md|astro|json)$/.test(name)) continue;
      const slug = name.replace(/\.(mdx|md|astro|json)$/, '');
      const prev = mtimeBySlug.get(slug);
      if (!prev || st.mtimeMs > prev) mtimeBySlug.set(slug, st.mtimeMs);
    }
  }
  candidates.forEach(walk);

  return urls.filter((u) => {
    const slug = slugFromUrl(u);
    const mtime = mtimeBySlug.get(slug);
    return mtime && mtime >= cutoff;
  });
}

async function ping(urls) {
  if (!urls.length) {
    console.log('[indexnow] No URLs to ping.');
    return;
  }
  // IndexNow accepts up to 10,000 URLs per POST.
  const batches = [];
  for (let i = 0; i < urls.length; i += 10000) batches.push(urls.slice(i, i + 10000));

  for (const batch of batches) {
    const payload = { host, key, keyLocation, urlList: batch };
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    console.log(`[indexnow] POST ${batch.length} urls -> ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[indexnow] body: ${text.slice(0, 400)}`);
    }
  }
}

const args = process.argv.slice(2);
let urls;
if (args.length === 0) {
  urls = urlsFromSitemap();
} else if (args[0] === '--changed') {
  urls = filterChangedInLast24h(urlsFromSitemap());
} else {
  urls = args;
}
console.log(`[indexnow] Pinging ${urls.length} URL(s) against host=${host} key=${key.slice(0, 8)}…`);
await ping(urls);
