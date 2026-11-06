import { getCollection } from 'astro:content';
import { resolvePrice, formatPrice } from './price';
import { LIVE_MARKETS } from '../data/markets';
import { productSearchKeywords } from './search-core.mjs';
import cityPages from '../data/oxygenConcentratorCityPages.json' with { type: 'json' };
import { intentConfigs, cityIntents } from './oxygen-city-intents';
import { partners, partnerPath, regions, serviceNames } from './respiratory-partners';

/** Compact wire format: market, type, name, brand, href, price, keywords, discontinued. */
export type SearchIndexItem = {
  m: string; t: 'd' | 'g' | 'c' | 'p' | 'm' | 'v' | 's' | 'l' | 'h'; n: string; b?: string; h: string;
  p?: string; k?: string; s?: boolean;
};

export async function getSearchIndex(): Promise<SearchIndexItem[]> {
  const [products, pap, guides, clinical, usGuides, intlGuides, comparisons, staticPages] = await Promise.all([
    getCollection('products'), getCollection('cpap-bipap'), getCollection('guides'),
    getCollection('clinical'), getCollection('us-guides'), getCollection('intl-guides'),
    getCollection('comparisons'), getCollection('static-search-pages'),
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
  const productsBySlug = new Map([...products, ...pap].map(entry => [entry.data.slug, entry.data]));
  for (const { data } of comparisons) {
    const a = productsBySlug.get(data.productA_slug);
    const b = productsBySlug.get(data.productB_slug);
    items.push({ m: 'in', t: 'v', n: `${a?.product_name || data.productA_name} vs ${b?.product_name || data.productB_name}`,
      h: `/compare/${data.slug}/`, k: [data.title, data.description, a?.brand, b?.brand,
        a && productSearchKeywords(a), b && productSearchKeywords(b)].filter(Boolean).join(' ') });
  }
  for (const entry of staticPages) items.push({ m: 'in', t: entry.id.startsWith('top-5/') ? 's' : 'h',
    n: entry.data.title, h: `/${entry.id}/`, k: [entry.data.description, ...entry.data.tags].join(' ') });
  for (const city of cityPages) {
    items.push({ m: 'in', t: 'l', n: city.title, h: `/oxygen-concentrators/5-lpm/${city.slug}/`, k: city.description });
    for (const intent of cityIntents) items.push({ m: 'in', t: 'l', n: intentConfigs[intent].h1(city.city),
      h: `/oxygen-concentrators/${intent}/${city.slug}/`, k: intentConfigs[intent].description(city.city) });
  }
  const serviceKeywords = ['Home Medix', 'respiratory care experts', 'oxygen concentrator', 'CPAP', 'BiPAP', 'BPAP', ...Object.values(serviceNames)].join(' ');
  items.push({ m: 'in', t: 'p', n: 'Home Medix respiratory care experts and service partners',
    h: '/in/respiratory-care-experts/', k: serviceKeywords });
  for (const region of regions) items.push({ m: 'in', t: 'p', n: `Home Medix service partners in ${region.name}`,
    h: `/in/respiratory-care-experts/${region.slug}/`, k: `${serviceKeywords} ${partners.filter(p => p.region === region.slug).map(p => `${p.name} ${p.city || ''}`).join(' ')}` });
  for (const partner of partners) items.push({ m: 'in', t: 'p', n: partner.name, b: 'Home Medix',
    h: partnerPath(partner), k: `${serviceKeywords} ${partner.slug} ${(partner.aliases || []).join(' ')} ${partner.city || ''} ${partner.region.replaceAll('-', ' ')} ${partner.description}` });
  items.push({ m: 'in', t: 'm', n: 'Respiratory device manufacturers in India', h: '/manufacturers/', k: 'manufacturer Indian manufacture origin legal manufacturer regulatory documents' },
    { m: 'in', t: 'm', n: 'Home Medix: respiratory medical device manufacturer in India', b: 'Home Medix',
      h: '/manufacturers/home-medix/', k: 'Bengaluru Karnataka oxygen concentrators CPAP BPAP BiPAP nebulisers manufacturer HM KV HM KX HM CV 20 HM BV 30' });
  return items.sort((a, b) => a.n.localeCompare(b.n) || a.h.localeCompare(b.h));
}
