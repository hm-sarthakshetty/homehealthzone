import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

// Exercise the real build-time generator with collection fixtures, without starting Astro.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'astro:content') return { url: 'data:text/javascript,export const getCollection = async name => globalThis.__searchCollections[name];', shortCircuit: true };
  if (context.parentURL?.endsWith('/search-index.ts') && (specifier === './price' || specifier === '../data/markets' || specifier === './respiratory-partners' || specifier === './oxygen-city-intents')) {
    return nextResolve(specifier + '.ts', context);
  }
  return nextResolve(specifier, context);
} });
const { getSearchIndex } = await import('../src/lib/search-index.ts');

test('includes every India guide and clinical article; regional results are actual guides and retired prices stay hidden', async () => {
  const ids = async (folder) => (await readdir(new URL(`../src/content/${folder}/`, import.meta.url))).filter(name => name.endsWith('.mdx')).map(name => name.replace(/\.mdx$/, ''));
  const articles = (collection, ids) => ids.map(id => ({ id, collection, data: { title: id, description: 'Respiratory information', tags: [] } }));
  const clinicalIds = await ids('clinical');
  const guideIds = await ids('guides');
  const product = (slug, stock = 'In Stock') => ({ collection: 'products', data: {
    slug, product_name: slug, brand: 'Brand', stock, price_current: '40,000', prices: {}, category: 'Concentrator', normalized_specs: {},
  } });
  const comparisonFiles = (await readdir(new URL('../src/content/comparisons/', import.meta.url))).filter(name => name.endsWith('.json'));
  const comparisons = await Promise.all(comparisonFiles.map(async name => ({ data: JSON.parse(await readFile(new URL(`../src/content/comparisons/${name}`, import.meta.url), 'utf8')) })));
  const staticIds = (await readdir(new URL('../src/pages/', import.meta.url), { recursive: true }))
    .filter(name => /^(top-5|oxygen-concentrators|cpap|bipap)\/.*\.mdx$/.test(name)).map(name => name.replace(/\.mdx$/, ''));
  const staticPages = articles('static-search-pages', staticIds);
  globalThis.__searchCollections = {
    comparisons, 'static-search-pages': staticPages,
    products: [product('current-device'), product('retired-device', 'Discontinued')],
    'cpap-bipap': [{ ...product('pap'), collection: 'cpap-bipap', data: { ...product('pap').data, device_type: 'bipap' } }],
    guides: articles('guides', guideIds), clinical: articles('clinical', clinicalIds),
    'us-guides': articles('us-guides', ['cpap-buyers-guide']),
    'intl-guides': articles('intl-guides', ['uk/oxygen-guide', 'au/oxygen-guide', 'unpublished/oxygen-guide']),
    // These must never become synthetic device results linking to generic guides.
    'us-products': [product('us-only')], 'intl-products': [product('intl-only')],
  };
  const index = await getSearchIndex();
  assert.ok(clinicalIds.length > 0);
  const byType = type => index.filter(item => item.t === type);
  assert.deepEqual(byType('v').map(item => item.h).sort(), comparisons.map(({ data }) => `/compare/${data.slug}/`).sort());
  for (const { data } of comparisons) assert.ok(byType('v').some(item => item.n === `${data.productA_name} vs ${data.productB_name}`));
  for (const entry of staticPages) {
    const result = index.find(item => item.h === `/${entry.id}/`);
    assert.equal(result?.n, entry.data.title);
    assert.equal(result?.t, entry.id.startsWith('top-5/') ? 's' : 'h');
    assert.match(result.k, /Respiratory information/);
  }
  assert.equal(byType('s').length, 10);
  assert.equal(byType('h').length, 18);
  const cities = JSON.parse(await readFile(new URL('../src/data/oxygenConcentratorCityPages.json', import.meta.url), 'utf8'));
  const { cityIntents, intentConfigs } = await import('../src/lib/oxygen-city-intents.ts');
  assert.equal(byType('l').length, cities.length * (cityIntents.length + 1));
  for (const city of cities) {
    assert.equal(index.find(item => item.h === `/oxygen-concentrators/5-lpm/${city.slug}/`)?.n, city.title);
    for (const intent of cityIntents) {
      const result = index.find(item => item.h === `/oxygen-concentrators/${intent}/${city.slug}/`);
      assert.equal(result?.n, intentConfigs[intent].h1(city.city));
      assert.equal(result?.k, intentConfigs[intent].description(city.city));
    }
  }
  assert.ok(index.filter(item => ['v', 's', 'l', 'h'].includes(item.t)).every(item => item.m === 'in'));
  assert.equal(new Set(index.map(item => item.h)).size, index.length);
  assert.equal(index.filter(item => item.t === 'c').length, clinicalIds.length);
  assert.equal(index.filter(item => item.m === 'in' && item.t === 'g').length, guideIds.length);
  assert.equal(index.filter(item => item.t === 'd').length, 3);
  assert.ok(index.filter(item => item.m !== 'in').every(item => item.t === 'g'));
  assert.ok(index.every(item => item.h.endsWith('/')));
  assert.ok(index.some(item => item.h === '/bipap/pap/'));
  assert.equal(index.find(item => item.n === 'retired-device').p, undefined);
  assert.equal(index.find(item => item.n === 'retired-device').s, true);
  assert.equal(index.find(item => item.n === 'current-device').p, '₹40,000');
  assert.ok(!index.some(item => item.m === 'unpublished'));
  const partnerResults = index.filter(item => item.t === 'p');
  assert.equal(partnerResults.length, 15);
  assert.ok(partnerResults.some(item => item.n === 'Aadhya Respiratory and Laboratory Services' && item.k.includes('Guntur')));
  assert.ok(partnerResults.every(item => item.m === 'in' && item.h.startsWith('/in/respiratory-care-experts/')));
  assert.ok(index.some(item => item.t === 'm' && item.h === '/manufacturers/home-medix/'));
});
