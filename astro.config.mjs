import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import remarkResolveCitations from './scripts/remark-resolve-citations.mjs';

const SITE_URL = 'https://homehealthzone.com';

// Regional twins (hreflang). Shared with BaseLayout.astro.
const HREFLANG_PAIRS = JSON.parse(readFileSync('./src/data/hreflang.json', 'utf8')).pairs;
const HREFLANG_BY_URL = new Map();
for (const pair of HREFLANG_PAIRS) {
  const links = Object.entries(pair).map(([lang, path]) => ({ lang, url: `${SITE_URL}${path}` }));
  if (!pair['x-default']) {
    links.push({ lang: 'x-default', url: `${SITE_URL}${pair['en-IN'] ?? Object.values(pair)[0]}` });
  }
  for (const path of Object.values(pair)) HREFLANG_BY_URL.set(`${SITE_URL}${path}`, links);
}

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

function toIso(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Build a URL -> ISO-8601 lastmod map by walking the content collections.
 * Only explicit editorial dates are included. Build time and filesystem
 * mtimes are not content-change signals and must not refresh sitemap dates.
 */
function buildLastmodMap() {
  const map = new Map();

  function addFromMdx(dir, urlBuilder) {
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
      const slug = file.replace(/\.(mdx|md)$/, '');
      const full = join(dir, file);
      let fm = {};
      try { fm = parseFrontmatter(readFileSync(full, 'utf8')); } catch {}
      const iso = toIso(fm.dateModified ?? fm.lastReviewed);
      const url = urlBuilder(slug);
      if (url && iso) map.set(url, iso);
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
  addFromMdx('./src/content/us-guides', (slug) => `${SITE_URL}/us/guides/${slug}/`);
  // Regional markets: src/content/intl-guides/{code}/{slug}.mdx -> /{code}/guides/{slug}/
  if (existsSync('./src/content/intl-guides')) {
    for (const d of readdirSync('./src/content/intl-guides', { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      addFromMdx(`./src/content/intl-guides/${d.name}`, (slug) => `${SITE_URL}/${d.name}/guides/${slug}/`);
    }
  }
  addFromMdx('./src/content/comparison-writeups', (slug) => `${SITE_URL}/compare/${slug}/`);

  // Reused product facts can change a page independently of its older review.
  const productUpdates = new Map();
  const setLatest = (url, date) => {
    if (date && (!map.get(url) || date > map.get(url))) map.set(url, date);
  };
  for (const group of ['products', 'cpap-bipap']) {
    for (const file of readdirSync(`./src/content/${group}`)) {
      if (!file.endsWith('.json')) continue;
      const data = JSON.parse(readFileSync(`./src/content/${group}/${file}`, 'utf8'));
      const date = toIso(data.dateModified);
      if (!date) continue;
      productUpdates.set(data.slug, date);
      const category = group === 'products' ? 'oxygen-concentrators' : data.device_type;
      setLatest(`${SITE_URL}/${category}/${data.slug}/`, date);
    }
  }
  for (const file of readdirSync('./src/content/comparisons')) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(`./src/content/comparisons/${file}`, 'utf8'));
    const slugs = [data.productA_slug, data.productB_slug];
    // EverFlo comparisons also render the shared HM-KV alternative card.
    if (slugs.includes('philips-everflo-5-lpm')) slugs.push('home-medix-5-lpm');
    const latest = slugs.map((slug) => productUpdates.get(slug)).filter(Boolean).sort().at(-1);
    setLatest(`${SITE_URL}/compare/${data.slug}/`, latest);
  }

  // City and city-intent pages share the explicit date on their source record.
  try {
    const cityPages = JSON.parse(readFileSync('./src/data/oxygenConcentratorCityPages.json', 'utf8'));
    for (const cityPage of cityPages) {
      const iso = toIso(cityPage.dateModified ?? cityPage.lastReviewed);
      if (!iso) continue;
      map.set(`${SITE_URL}/oxygen-concentrators/5-lpm/${cityPage.slug}/`, iso);
      for (const intent of ['service', 'repair', 'dealers', 'price', 'rental']) {
        map.set(`${SITE_URL}/oxygen-concentrators/${intent}/${cityPage.slug}/`, iso);
      }
    }
  } catch {}

  // Static MDX/Markdown pages can provide an explicit lastReviewed date.
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
      let fm = {};
      try { fm = parseFrontmatter(readFileSync(full, 'utf8')); } catch {}
      const iso = toIso(fm.dateModified ?? fm.lastReviewed);
      if (iso) map.set(`${SITE_URL}${urlPath}`, iso);
    }
  }
  walkPages('./src/pages', '/');

  return map;
}

const LASTMOD_MAP = buildLastmodMap();
// Explicit dates for structural pages; never substitute build time for an edit.
const PAGE_UPDATES = JSON.parse(readFileSync('./src/data/page-updates.json', 'utf8'));
for (const [path, date] of Object.entries(PAGE_UPDATES)) {
  const iso = toIso(date);
  if (iso) LASTMOD_MAP.set(`${SITE_URL}${path}`, iso);
}

export default defineConfig({
  site: SITE_URL,
  redirects: {
    '/clinical/bipap-st-mode-indications/': '/clinical/bipap-st-mode-and-indications/',
    '/clinical/epflex-epr-flex-c-flex-explained/': '/clinical/epflex-epr-flex-cflex-explained/',
    '/clinical/heated-tubing-clinical-evidence-indian-climate/': '/clinical/heated-tubing-clinical-evidence/',
    '/clinical/how-to-verify-ce-mark-imports/': '/clinical/how-to-verify-ce-mark-imported-devices/',
    '/clinical/is-2-lpm-enough-flow-rate-selection/': '/clinical/is-2-lpm-enough-flow-selection/',
    '/clinical/nasal-cannula-vs-mask-vs-non-rebreather-vs-venturi/': '/clinical/nasal-cannula-vs-simple-mask-vs-non-rebreather-vs-venturi/',
    '/clinical/osa-vs-central-vs-complex-sleep-apnea/': '/clinical/osa-vs-central-apnea-vs-complex-sleep-apnea/',
    '/clinical/oxygen-concentrator-electricity-cost-india/': '/clinical/oxygen-concentrator-electricity-cost-by-state/',
    '/clinical/post-covid-long-term-oxygen-evidence-2024-26/': '/clinical/post-covid-long-term-oxygen/',
    '/clinical/reading-a-cpap-report-line-by-line/': '/clinical/reading-cpap-report-airview-care-orchestrator-icode/',
    '/clinical/understanding-spo2-vs-pao2-vs-sao2/': '/clinical/spo2-vs-pao2-vs-sao2/',
    '/clinical/stabiliser-vs-ups-vs-inverter-for-concentrators/': '/clinical/stabilizer-ups-vs-inverter-for-concentrator/',
    '/clinical/traveling-with-oxygen-concentrator-india/': '/clinical/traveling-with-oxygen-indian-railways-indigo-air-india/',
    '/us/guides/houston-hurricane-cpap-oxygen/': '/us/guides/hurricane-plan-cpap-oxygen/',
    '/us/guides/miami-hurricane-cpap-oxygen/': '/us/guides/hurricane-plan-cpap-oxygen/',
    '/us/guides/new-orleans-hurricane-cpap-oxygen/': '/us/guides/hurricane-plan-cpap-oxygen/',
    '/us/guides/tampa-hurricane-cpap-oxygen/': '/us/guides/hurricane-plan-cpap-oxygen/',
  },
  integrations: [
    sitemap({
      filter: (url) => !['/search/', '/404/'].includes(new URL(url).pathname),
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        const lastmod = LASTMOD_MAP.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        const links = HREFLANG_BY_URL.get(item.url);
        if (links) item.links = links;
        return item;
      },
    }),
    mdx({
      remarkPlugins: [remarkResolveCitations],
    }),
  ],
  markdown: {
    remarkPlugins: [remarkResolveCitations],
  },
  build: { inlineStylesheets: 'always' },
  trailingSlash: 'always',
});
