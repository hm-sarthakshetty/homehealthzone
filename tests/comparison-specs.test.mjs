import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildComparisonSpecRows } from '../src/lib/comparison-specs.mjs';

const readProduct = async (slug) => JSON.parse(await readFile(new URL(`../src/content/products/${slug}.json`, import.meta.url), 'utf8'));

test('actual HM-KV and Oxygenate records have one complete warranty, purity, power and flow-control row', async () => {
  const [hm, oxygenate] = await Promise.all([readProduct('home-medix-5-lpm'), readProduct('philips-oxygenate-5')]);
  const rows = buildComparisonSpecRows(hm, oxygenate);
  for (const key of ['Warranty', 'Oxygen concentration', 'Flow control / display', 'Electrical rating (as published)', 'Model designation', 'Manufacturer', 'Country of production', 'Power supply', 'Outlet pressure', 'Filtration']) {
    const matches = rows.filter((row) => row.key === key);
    assert.equal(matches.length, 1, key);
    assert.ok(matches[0].a && matches[0].b, key);
  }
  const warranty = rows.find((row) => row.key === 'Warranty');
  assert.match(warranty.a, /3 years or 10,000 operating hours, whichever comes first/);
  assert.match(warranty.b, /3-year limited warranty.*10,000-hour sieve warranty/);
  const power = rows.find((row) => row.key === 'Electrical rating (as published)');
  assert.match(power.a, /320 W/);
  assert.match(power.b, /360 VA/);
  for (const [key, value] of Object.entries({ 'Country of production': 'India', 'Power supply': '230 V / 50 Hz', 'Outlet pressure': '40–80 kPa', 'Filtration': 'HEPA filter' })) {
    assert.equal(rows.find((row) => row.key === key).a, value);
  }
  assert.equal(new Set(rows.map((row) => row.key.toLowerCase())).size, rows.length);
});

test('missing input voltage stays unknown and is not inferred from an Indian-voltage flag or address', () => {
  const rows = buildComparisonSpecRows({ normalized_specs: { indian_voltage: true }, spec_tables: { Details: { 'Company Headquarters': 'India' } } }, { spec_tables: { Details: { 'Power supply': '230 V / 50 Hz' } } });
  assert.equal(rows.find((row) => row.key === 'Power supply').a, '');
  assert.equal(rows.find((row) => row.key === 'Company headquarters').b, '');
});

test('purity monitoring and live purity analysis remain distinct from oxygen concentration', () => {
  const rows = buildComparisonSpecRows({ key_features: { Purity: '93% ±3%', 'Oxygen Purity Indicator (OPI)': 'Yes', 'Oxygen Purity % Analyzer': 'Not established' } }, { key_features: { 'Oxygen concentration': '93% ±3%' } });
  assert.equal(rows.length, 3);
  assert.ok(rows.find((row) => row.key === 'Oxygen concentration').b);
  assert.equal(rows.find((row) => row.key === 'Oxygen Purity Indicator (OPI)').b, '');
});
