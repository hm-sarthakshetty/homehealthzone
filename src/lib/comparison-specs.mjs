// Compare equivalent fields across catalogue sections without converting their
// values or treating an undocumented feature as an absent feature.
const normalize = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
const definitions = [
  ['Oxygen concentration', ['Purity', 'Oxygen purity', 'Oxygen concentration']],
  ['Continuous flow', ['Continuous Flow', 'Continuous flow rate']],
  ['Flow control / display', ['Flow control', 'Flow display']],
  ['Electrical rating (as published)', ['Power consumption', 'Electrical rating']],
  ['Model designation', ['Model', 'Model designation', 'Manufacturer model']],
  ['Manufacturer', ['Manufacturer', 'Manufacturer name']],
  ['Country of production', ['Country of production', 'Country of origin']],
  ['Offer / package notes', ['Offer details', 'Price and service']],
  ['Company headquarters', ['Company Headquarters', 'Company Headquaters']],
  ['Brand / distribution role', ['Philips role', 'Brand / distribution role']],
];
const aliases = new Map(definitions.flatMap(([label, keys]) => keys.map((key) => [normalize(key), label])));
const canonical = (key) => normalize(aliases.get(normalize(key)) ?? key);
const labelFor = (key) => aliases.get(normalize(key)) ?? key;

function collect(product) {
  const entries = [];
  const add = (key, value, section, priority) => {
    const text = value == null ? '' : String(value).trim();
    if (text) entries.push({ key: labelFor(key), id: canonical(key), value: text, section, priority });
  };
  for (const [key, value] of Object.entries(product.key_features ?? {})) add(key, value, 'Key features', 0);
  for (const [section, fields] of Object.entries(product.spec_tables ?? {})) {
    // Detailed technical tables retain their conditions and qualifications in
    // preference to abbreviated headline features.
    const priority = /technical/i.test(section) ? 30 : 20;
    for (const [key, value] of Object.entries(fields)) add(key, value, section, priority);
  }
  add('Manufacturer', product.manufacturer_name, 'Manufacturer and origin', 10);
  add('Model designation', product.model, 'Manufacturer and origin', 10);
  add('Country of production', product.country_of_origin, 'Manufacturer and origin', 10);
  add('Offer details', product.prices?.IN?.configuration, 'Overview', 40);
  return entries;
}

export function buildComparisonSpecRows(productA, productB) {
  const a = collect(productA);
  const b = collect(productB);
  const best = (entries) => {
    const result = new Map();
    for (const entry of entries) {
      if (!result.has(entry.id) || entry.priority > result.get(entry.id).priority) result.set(entry.id, entry);
    }
    return result;
  };
  const valuesA = best(a);
  const valuesB = best(b);
  const seen = new Set();
  const rows = [];
  for (const entry of [...a, ...b]) {
    if (['brand', 'category', 'price', 'mrp', 'stock'].includes(entry.id)) continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const preferred = valuesA.get(entry.id) ?? valuesB.get(entry.id);
    const section = entry.id === canonical('Warranty') ? 'Package and warranty'
      : ['manufacturer', 'modeldesignation', 'countryofproduction'].includes(entry.id) ? 'Manufacturer and origin'
      : entry.id === canonical('Offer details') ? 'Overview' : preferred.section;
    rows.push({ key: entry.key, a: valuesA.get(entry.id)?.value ?? '', b: valuesB.get(entry.id)?.value ?? '', section });
  }
  return rows;
}
