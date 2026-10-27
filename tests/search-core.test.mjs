import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, productSearchKeywords, prepareSearchItem, fromIndexItem, rankSearch, loadSearchIndex } from '../src/lib/search-core.mjs';
const item = (name, extras = {}) => prepareSearchItem({ name, brand: '', href: '/example/', market: 'in', type: 'd', ...extras });

test('normalizes model numbers, flow units, accents and S/T modes', () => {
  assert.equal(normalizeSearch('AirSense11'), normalizeSearch('airsense 11'));
  assert.equal(normalizeSearch('10LPM'), normalizeSearch('10 lpm'));
  assert.equal(normalizeSearch('BiPAP S/T'), normalizeSearch('bipap st'));
  assert.equal(normalizeSearch('  APNÉA—test  '), 'apnea test');
});
test('matches every token regardless of order and ranks model name above description', () => {
  const products = [item('A guide', { type: 'g', keywords: 'ResMed AirSense 11' }), item('ResMed AirSense 11 AutoSet')];
  assert.deepEqual(rankSearch(products, 'AirSense11').map(x => x.name), ['ResMed AirSense 11 AutoSet', 'A guide']);
  assert.equal(rankSearch(products, '11 resmed airsense')[0].name, 'ResMed AirSense 11 AutoSet');
  assert.equal(rankSearch(products, 'airsense 12').length, 0);
});
test('flow and mode searches include structured specifications without inventing aliases', () => {
  const data = { category: 'BiPAP', key_features: { Modes: 'CPAP, S, S/T, T' }, normalized_specs: { flow_max_lpm: 10 } };
  const keywords = productSearchKeywords(data);
  assert.equal(rankSearch([item('BMC RESMART GII', { keywords })], 'bipap st').length, 1);
  assert.equal(rankSearch([item('Concentrator', { keywords })], '10lpm').length, 1);
  assert.equal(rankSearch([item('100 LPM')], '10lpm').length, 0);
});
test('market and content-type filters retain all clinical matches', () => {
  const items = [item('Sleep apnea', { type: 'c' }), item('Sleep apnea guide', { type: 'g', market: 'us' }), item('Sleep device')];
  assert.equal(rankSearch(items, 'sleep', { market: 'in' }).length, 2);
  assert.equal(rankSearch(items, '', { resultType: 'clinical' }).length, 1);
  assert.equal(rankSearch(items, '', { market: 'us', resultType: 'device' }).length, 0);
});
test('wire data never exposes a discontinued product price', () => {
  const parsed = fromIndexItem({ n: 'Old CPAP', m: 'in', t: 'd', h: '/cpap/old/', p: '₹40,000', s: true });
  assert.equal(parsed.price, '');
  assert.equal(parsed.discontinued, true);
  assert.equal(parsed.slug, 'old');
});
test('service partner and manufacturer results remain distinct from device reviews', async () => {
  const index = await loadSearchIndex('/partner-types.json', async () => ({ ok: true, json: async () => [
    { m: 'in', t: 'p', n: 'Mother Med', b: 'Home Medix', h: '/in/respiratory-care-experts/kerala/mothermed/', k: 'Mothermed Kottayam mask fitting rentals' },
    { m: 'in', t: 'm', n: 'Home Medix manufacturer', h: '/manufacturers/home-medix/', k: 'India respiratory devices' },
    { m: 'in', t: 'd', n: 'Home Medix CPAP', h: '/cpap/home-medix-cv-20/' },
  ] }));
  assert.equal(rankSearch(index, 'mothermed', { resultType: 'partner' })[0].name, 'Mother Med');
  assert.equal(rankSearch(index, 'Home Medix', { resultType: 'manufacturer' }).length, 1);
  assert.equal(rankSearch(index, 'Home Medix', { resultType: 'device' }).length, 1);
  await assert.rejects(loadSearchIndex('/invalid-partner-type.json', async () => ({ ok: true, json: async () => [{ m: 'in', t: '__proto__', n: 'Invalid', h: '/example/' }] })));
});
test('index load shares successful requests and permits retry after HTTP or data failure', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return { ok: calls > 1, json: async () => [{ m: 'in', t: 'c', n: 'Oxygen', h: '/clinical/oxygen/' }] }; };
  await assert.rejects(loadSearchIndex('/retry-test.json', fetcher));
  const [a, b] = await Promise.all([loadSearchIndex('/retry-test.json', fetcher), loadSearchIndex('/retry-test.json', fetcher)]);
  assert.equal(calls, 2);
  assert.equal(a, b);
  assert.equal(a[0].type, 'c');
  await assert.rejects(loadSearchIndex('/bad-test.json', async () => ({ ok: true, json: async () => [{ n: 'Unsafe', h: '//external.example', m: 'in', t: 'd' }] })));
});
