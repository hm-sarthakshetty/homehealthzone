import { getCollection } from 'astro:content';
import { resolvePrice, formatPrice } from './price';
import { LIVE_MARKETS } from '../data/markets';
import { productSearchKeywords } from './search-core.mjs';

/** Compact wire format: market, type, name, brand, href, price, keywords, discontinued. */
export type SearchIndexItem = {
  m: string; t: 'd' | 'g' | 'c'; n: string; b?: string; h: string;
  p?: string; k?: string; s?: boolean;
};

export async function getSearchIndex(): Promise<SearchIndexItem[]> {
  const [products, pap, guides, clinical, usGuides, intlGuides] = await Promise.all([
    getCollection('products'), getCollection('cpap-bipap'), getCollection('guides'),
    getCollection('clinical'), getCollection('us-guides'), getCollection('intl-guides'),
  ]);
  const items: SearchIndexItem[] = [];
  // The product directory is India-only. Every device result points to its own review.
  for (const entry of [...products, ...pap]) {
    const data = entry.data;
    const discontinued = data.stock.toLowerCase().includes('discontinued');
    const route = entry.collection === 'cpap-bipap' ? entry.data.device_type : 'oxygen-concentrators';
    items.push({ m: 'in', t: 'd', n: data.product_name, b: data.brand || undefined,
      h: `/${route}/${data.slug}/`, k: productSearchKeywords(data),
      ...(discontinued ? { s: true } : { p: formatPrice(resolvePrice(data, 'IN')) || undefined }) });
  }
  for (const [entries, type, route] of [[guides, 'g', 'guides'], [clinical, 'c', 'clinical']] as const) {
    for (const entry of entries) items.push({ m: 'in', t: type, n: entry.data.title,
      h: `/${route}/${entry.id}/`, k: [entry.data.description, ...entry.data.tags].join(' ') });
  }
  for (const entry of usGuides) items.push({ m: 'us', t: 'g', n: entry.data.title,
    h: `/us/guides/${entry.id}/`, k: [entry.data.description, ...entry.data.tags].join(' ') });
  const liveMarkets = new Set(LIVE_MARKETS.map((market) => market.code));
  for (const entry of intlGuides) {
    const [market, ...slug] = entry.id.split('/');
    if (liveMarkets.has(market)) items.push({ m: market, t: 'g', n: entry.data.title,
      h: `/${market}/guides/${slug.join('/')}/`, k: [entry.data.description, ...entry.data.tags].join(' ') });
  }
  return items.sort((a, b) => a.n.localeCompare(b.n) || a.h.localeCompare(b.h));
}
