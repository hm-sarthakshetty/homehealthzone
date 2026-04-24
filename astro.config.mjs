import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = 'https://homehealthzone.com';

/**
 * Parse the YAML frontmatter block at the top of a markdown/MDX file.
 * Returns only the scalar top-level fields we care about for sitemap lastmod.
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+?)\s*$/);
    if (!kv) continue;
    let value = kv[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fm[kv[1]] = value;
  }
  return fm;
}

function toIso(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

/**
 * Build a URL -> ISO-8601 lastmod map by walking the content collections.
 * Every product review + clinical article + guide + comparison writeup uses
 * its `lastReviewed` frontmatter as the canonical freshness signal; static
 * Astro pages fall back to the source file mtime.
 */
function buildLastmodMap() {
  const map = new Map();
  const fallback = new Date().toISOString();

  function addFromMdx(dir, urlBuilder) {
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
      const slug = file.replace(/\.(mdx|md)$/, '');
      const full = join(dir, file);
      let fm = {};
      try { fm = parseFrontmatter(readFileSync(full, 'utf8')); } catch {}
      let mtime = fallback;
      try { mtime = statSync(full).mtime.toISOString(); } catch {}
      const iso = toIso(fm.lastReviewed, mtime);
      const url = urlBuilder(slug);
      if (url) map.set(url, iso);
    }
  }

  function deviceTypeForSlug(slug) {
    // CPAP/BiPAP review MDX doesn't carry device_type; look it up in the product JSON.
    const productPath = join('./src/content/cpap-bipap', `${slug}.json`);
    if (!existsSync(productPath)) return 'cpap';
    try {
      const data = JSON.parse(readFileSync(productPath, 'utf8'));
      return data.device_type === 'bipap' ? 'bipap' : 'cpap';
    } catch { return 'cpap'; }
  }

  addFromMdx('./src/content/product-reviews', (slug) => `${SITE_URL}/oxygen-concentrators/${slug}/`);
  addFromMdx('./src/content/cpap-bipap-reviews', (slug) => `${SITE_URL}/${deviceTypeForSlug(slug)}/${slug}/`);
  addFromMdx('./src/content/clinical', (slug) => `${SITE_URL}/clinical/${slug}/`);
  addFromMdx('./src/content/guides', (slug) => `${SITE_URL}/guides/${slug}/`);
  addFromMdx('./src/content/comparison-writeups', (slug) => `${SITE_URL}/compare/${slug}/`);

  // Pillar + static pages under src/pages: use file mtime.
  function walkPages(dir, baseUrlPath) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkPages(full, `${baseUrlPath}${entry.name}/`);
        continue;
      }
      if (!/\.(astro|mdx|md)$/.test(entry.name)) continue;
      if (entry.name.startsWith('[')) continue; // dynamic route files
      const stem = entry.name.replace(/\.(astro|mdx|md)$/, '');
      const urlPath = stem === 'index' ? baseUrlPath : `${baseUrlPath}${stem}/`;
      let mtime = fallback;
      try { mtime = statSync(full).mtime.toISOString(); } catch {}
      // Prefer frontmatter lastReviewed if the page defines one
      let fm = {};
      try { fm = parseFrontmatter(readFileSync(full, 'utf8')); } catch {}
      map.set(`${SITE_URL}${urlPath}`, toIso(fm.lastReviewed, mtime));
    }
  }
  walkPages('./src/pages', '/');

  return map;
}

const LASTMOD_MAP = buildLastmodMap();
const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  site: SITE_URL,
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        item.lastmod = LASTMOD_MAP.get(item.url) ?? BUILD_TIME;
        return item;
      },
    }),
    mdx(),
  ],
  build: { inlineStylesheets: 'auto' },
  trailingSlash: 'always',
});
