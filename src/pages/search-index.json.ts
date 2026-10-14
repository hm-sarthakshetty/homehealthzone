/**
 * Static cross-market search index, built once at build time and fetched
 * lazily by SearchBox (src="/search-index.json") on first focus.
 * Compact keys: m market, t type (d device / g guide), n name, b brand,
 * h href, p display price (local currency) or omitted.
 */
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { resolvePrice, formatPrice, type Country } from '../lib/price';
import { LIVE_MARKETS } from '../data/markets';

type Item = { m: string; t: 'd' | 'g'; n: string; b?: string; h: string; p?: string };

export const GET: APIRoute = async () => {
  const [products, pap, guides, usGuides, usProducts, intlGuides, intlProducts] = await Promise.all([
    getCollection('products'),
    getCollection('cpap-bipap'),
    getCollection('guides'),
    getCollection('us-guides'),
    getCollection('us-products'),
    getCollection('intl-guides'),
    getCollection('intl-products'),
  ]);
  const items: Item[] = [];
  const price = (data: any, c: Country) => {
    const r = resolvePrice(data, c);
    return r.amount === null && !r.rawCurrent ? undefined : formatPrice(r) ?? undefined;
  };

  // India: same devices and hrefs as the India SearchBox, plus India guides.
  for (const e of products) items.push({ m: 'in', t: 'd', n: e.data.product_name, b: e.data.brand, h: `/oxygen-concentrators/${e.data.slug}/`, p: price(e.data, 'IN') });
  for (const e of pap) items.push({ m: 'in', t: 'd', n: e.data.product_name, b: e.data.brand, h: `/${e.data.device_type}/${e.data.slug}/`, p: price(e.data, 'IN') });
  for (const g of guides) items.push({ m: 'in', t: 'g', n: g.data.title, h: `/guides/${g.id}/` });

  // US: mirrors the /us/ hub (listed + verified USD price), linking to the hub's guide for that type.
  const usListed = (d: any) => d.countries.includes('US') && resolvePrice(d, 'US').amount !== null;
  const usHref = (type: string, flow = 0) =>
    type === 'portable-oxygen-concentrator' ? '/us/guides/best-portable-oxygen-concentrator/'
    : type === 'cpap-mask' ? '/us/guides/best-cpap-masks/'
    : type === 'cpap' || type === 'bipap' ? '/us/guides/cpap-buyers-guide/'
    : flow >= 10 ? '/us/guides/5-lpm-vs-10-lpm/' : '/us/guides/oxygen-concentrator-buyers-guide/';
  for (const e of [...products, ...pap, ...usProducts] as any[]) {
    if (!usListed(e.data)) continue;
    const type = e.collection === 'products' ? 'oxygen-concentrator' : e.data.device_type;
    items.push({ m: 'us', t: 'd', n: e.data.product_name, b: e.data.brand, h: usHref(type, e.data.normalized_specs?.flow_max_lpm ?? 0), p: price(e.data, 'US') });
  }
  for (const g of usGuides) items.push({ m: 'us', t: 'g', n: g.data.title, h: `/us/guides/${g.id}/` });

  // Regional markets: mirrors the /{code}/ hub cards and guide routes.
  for (const mk of LIVE_MARKETS) {
    const ids = new Set(intlGuides.filter((g) => g.id.startsWith(`${mk.code}/`)).map((g) => g.id.split('/').slice(1).join('/')));
    for (const g of intlGuides) if (g.id.startsWith(`${mk.code}/`)) items.push({ m: mk.code, t: 'g', n: g.data.title, h: `/${mk.code}/guides/${g.id.split('/').slice(1).join('/')}/` });
    for (const e of intlProducts) {
      if (!e.data.countries.includes(mk.country) || resolvePrice(e.data as any, mk.country).amount === null) continue;
      const gs = e.data.guides[mk.code];
      items.push({ m: mk.code, t: 'd', n: e.data.product_name, b: e.data.brand, h: gs && ids.has(gs) ? `/${mk.code}/guides/${gs}/` : `/${mk.code}/guides/`, p: price(e.data, mk.country) });
    }
  }
  for (const i of items) { if (!i.b) delete i.b; if (!i.p) delete i.p; }
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
};
