import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readdir } from 'node:fs/promises';

// Exercise the real build-time generator with collection fixtures, without starting Astro.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'astro:content') return { url: 'data:text/javascript,export const getCollection = async name => globalThis.__searchCollections[name];', shortCircuit: true };
  if (context.parentURL?.endsWith('/search-index.ts') && (specifier === './price' || specifier === '../data/markets')) {
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
  globalThis.__searchCollections = {
    products: [product('current-device'), product('retired-device', 'Discontinued')],
    'cpap-bipap': [{ ...product('pap'), collection: 'cpap-bipap', data: { ...product('pap').data, device_type: 'bipap' } }],
    guides: articles('guides', guideIds), clinical: articles('clinical', clinicalIds),
    'us-guides': articles('us-guides', ['cpap-buyers-guide']),
    'intl-guides': articles('intl-guides', ['uk/oxygen-guide', 'au/oxygen-guide', 'unpublished/oxygen-guide']),
    // These must never become synthetic device results linking to generic guides.
    'us-products': [product('us-only')], 'intl-products': [product('intl-only')],
  };
  const index = await getSearchIndex();
  assert.equal(clinicalIds.length, 80);
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
});
