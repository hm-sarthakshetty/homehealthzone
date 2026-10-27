/** Shared by autocomplete and the complete results page. Keep matching deterministic. */
export const MARKET_LABELS = {
  in: 'India', us: 'United States', uk: 'United Kingdom', sg: 'Singapore',
  au: 'Australia', ca: 'Canada', nz: 'New Zealand',
};
export const TYPE_LABELS = { d: 'Device review', g: 'Buying guide', c: 'Clinical article', p: 'Service partner', m: 'Manufacturer reference' };
export const TYPE_CODES = { device: 'd', guide: 'g', clinical: 'c', partner: 'p', manufacturer: 'm' };

export function normalizeSearch(value = '') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/([a-z])(\d)|(\d)([a-z])/g, '$1$3 $2$4')
    .replace(/\bs\s*[\/-]\s*t\b/g, 'st')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function productSearchKeywords(data) {
  const fields = [data.category, data.device_type, data.slug];
  const flow = data.normalized_specs?.flow_max_lpm;
  if (flow) fields.push(`${flow} lpm`);
  // Modes distinguish S/T devices even when their product name only says BiPAP.
  for (const specs of [data.key_features, ...Object.values(data.spec_tables || {})]) {
    for (const [name, value] of Object.entries(specs || {})) {
      if (/mode|flow|type/i.test(name)) fields.push(String(value));
    }
  }
  return fields.filter(Boolean).join(' ');
}

export function prepareSearchItem(item) {
  const name = normalizeSearch(item.name);
  const brand = normalizeSearch(item.brand);
  const keywords = normalizeSearch(item.keywords);
  return { ...item, _name: name, _brand: brand, _keywords: keywords,
    _text: [name, brand, keywords].filter(Boolean).join(' '),
    _compactName: name.replace(/ /g, '') };
}

export function fromIndexItem(item) {
  return prepareSearchItem({ name: item.n, brand: item.b || '', href: item.h,
    slug: item.h.split('/').filter(Boolean).at(-1), market: item.m, type: item.t,
    keywords: item.k || '', price: item.s ? '' : item.p || '', discontinued: !!item.s });
}

export function rankSearch(items, query, { market = 'all', resultType = 'all' } = {}) {
  const q = normalizeSearch(query);
  const tokens = q.split(' ').filter(Boolean);
  const compact = q.replace(/ /g, '');
  const type = TYPE_CODES[resultType];
  return items.filter((item) => (market === 'all' || item.market === market) && (!type || item.type === type))
    .map((item) => {
      if (!q) return { item, score: 0 };
      const words = item._text.split(' ');
      // Every token must match: reordered words work; unrelated results do not leak in.
      if (!tokens.every((token) => words.some((word) => /^\d+$/.test(token) ? word === token : word.startsWith(token)))) return null;
      let score = item._name === q ? 1000 : item._compactName === compact ? 950 : 0;
      if (item._name.startsWith(q)) score += 300;
      if (item._name.includes(q)) score += 150;
      for (const token of tokens) {
        if (item._name.split(' ').includes(token)) score += 30;
        else if (item._name.split(' ').some((word) => word.startsWith(token))) score += 15;
        if (item._brand.split(' ').includes(token)) score += 10;
      }
      return { item, score };
    }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name) || a.item.href.localeCompare(b.item.href))
    .map(({ item }) => item);
}

/** Failed requests are evicted so retry works; successful requests are shared by boxes. */
const indexRequests = new Map();
export function loadSearchIndex(src, fetcher = fetch) {
  if (!indexRequests.has(src)) {
    const request = Promise.resolve().then(() => fetcher(src)).then((response) => {
      if (!response.ok) throw new Error('Search index request failed');
      return response.json();
    }).then((raw) => {
      if (!Array.isArray(raw) || raw.some((item) => !item || typeof item.n !== 'string' || typeof item.h !== 'string' || !item.h.startsWith('/') || item.h.startsWith('//') || !Object.hasOwn(TYPE_LABELS, item.t) || !Object.hasOwn(MARKET_LABELS, item.m))) {
        throw new Error('Invalid search index');
      }
      return raw.map(fromIndexItem);
    }).catch((error) => { indexRequests.delete(src); throw error; });
    indexRequests.set(src, request);
  }
  return indexRequests.get(src);
}
