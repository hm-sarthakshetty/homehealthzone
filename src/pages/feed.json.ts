import { getCollection } from 'astro:content';
import type { APIContext, APIRoute } from 'astro';
import cityPages from '../data/oxygenConcentratorCityPages.json';

const SITE_NAME = 'HHZ Respiratory Review';
const SITE_DESCRIPTION =
  'Independent editorial reviews of oxygen concentrators, CPAP, BiPAP, and respiratory equipment sold in India.';
const BUYER_INTENT_REVIEW_DATE = '2026-07-09';

interface JsonFeedItem {
  id: string;
  url: string;
  title: string;
  content_text: string;
  summary: string;
  date_published: string;
  date_modified: string;
  authors: Array<{ name: string }>;
  tags: string[];
  language: string;
}

function safeISO(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const curatedBuyerPages = [
  {
    title: 'Oxygen Concentrator Brands in India (2026 Landscape)',
    description:
      'Brand-by-brand positioning of oxygen concentrators sold in India, including Home Medix, Oxymed, Philips, Nidek, DeVilbiss, AirSep, BPL, Yuwell, service risk, imported-stock checks, and city buying routes.',
    path: '/oxygen-concentrators/brands/',
    tags: ['oxygen-concentrator', 'brands', 'india', 'buyer-intent'],
  },
  {
    title: '5 LPM Oxygen Concentrators in India',
    description:
      'India 5 LPM oxygen concentrator category guide covering Home Medix HM-KV, Oxymed Mini, Philips EverFlo, AirSep, Nidek, DeVilbiss, price bands, service, and old-stock risk.',
    path: '/oxygen-concentrators/5-lpm/',
    tags: ['oxygen-concentrator', '5-lpm', 'home-oxygen', 'buyer-intent'],
  },
  {
    title: '10 LPM Oxygen Concentrators in India',
    description:
      'High-flow oxygen concentrator guide for Indian buyers comparing Home Medix HM-KX, Oxymed 10 LPM, Nidek Nuvo 10, DeVilbiss 10 LPM, and other 10 LPM options.',
    path: '/oxygen-concentrators/10-lpm/',
    tags: ['oxygen-concentrator', '10-lpm', 'high-flow', 'buyer-intent'],
  },
  {
    title: 'Oxygen Concentrator Price in India',
    description:
      'India oxygen concentrator price guide covering 5 LPM, 10 LPM, portable, imported, rental, warranty, and service-driven buying bands.',
    path: '/oxygen-concentrators/price-india/',
    tags: ['oxygen-concentrator', 'price', 'india', 'buyer-intent'],
  },
  {
    title: 'Oxygen Concentrator Rental in India',
    description:
      'Rent-vs-buy guide for Indian oxygen concentrator buyers, including monthly rental risk, fleet condition, warranty, service, and long-term purchase economics.',
    path: '/oxygen-concentrators/rental/',
    tags: ['oxygen-concentrator', 'rental', 'india', 'buyer-intent'],
  },
  {
    title: 'Top 5 5 LPM Oxygen Concentrators in India',
    description:
      'HHZ editorial ranking of 5 LPM oxygen concentrators in India, including Philips EverFlo, AirSep VisionAire 5, DeVilbiss 525, Nidek Nuvo Lite, and Home Medix HM-KV.',
    path: '/top-5/5-lpm-oxygen-concentrators/',
    tags: ['oxygen-concentrator', '5-lpm', 'ranking', 'buyer-intent'],
  },
  {
    title: 'Top 5 Oxygen Concentrators Under Rs 40,000 in India',
    description:
      'Budget oxygen concentrator ranking for India covering Home Medix HM-KV, Oxymed Mini, Nareena, Evox, GVS, CDSCO, service, and value risk.',
    path: '/top-5/oxygen-concentrators-under-40000/',
    tags: ['oxygen-concentrator', 'price', 'under-40000', 'buyer-intent'],
  },
  {
    title: 'Top 5 Oxygen Concentrators for COPD Home Use in India',
    description:
      'COPD home oxygen concentrator ranking for India focused on chronic-use suitability, warranty depth, service-network reach, and 5 LPM model choice.',
    path: '/top-5/oxygen-concentrators-for-copd/',
    tags: ['oxygen-concentrator', 'copd', 'home-oxygen', 'buyer-intent'],
  },
  {
    title: 'CPAP Brands in India',
    description:
      'CPAP brand landscape for India covering ResMed, Philips, BMC, Oxymed, Home Medix, Breas, Wellell, service, algorithms, and warranty reality.',
    path: '/cpap/brands/',
    tags: ['cpap', 'brands', 'india', 'buyer-intent'],
  },
  {
    title: 'BiPAP ST in India',
    description:
      'BiPAP ST mode buyer reference for India covering backup rate, clinical indications, ResMed, Philips, BMC, Oxymed, Home Medix, and device selection.',
    path: '/bipap/st/',
    tags: ['bipap', 'st', 'niv', 'buyer-intent'],
  },
];

const cityIntentLabels = [
  ['service', 'Oxygen Concentrator Service Centre', 'Buyer Checklist'],
  ['repair', 'Oxygen Concentrator Repair', 'Cost and Service Checklist'],
  ['dealers', 'Oxygen Concentrator Dealers', 'What to Verify Before Buying'],
  ['price', 'Oxygen Concentrator Price', '5 LPM Buying Bands'],
  ['rental', 'Oxygen Concentrator Rental', 'Rent vs Buy Checklist'],
] as const;

function makeJsonFeedItem(
  site: URL,
  path: string,
  title: string,
  description: string,
  tags: string[],
  date = BUYER_INTENT_REVIEW_DATE
): JsonFeedItem {
  const url = new URL(path, site).toString();
  return {
    id: url,
    url,
    title,
    content_text: description,
    summary: description,
    date_published: safeISO(date),
    date_modified: safeISO(date),
    authors: [{ name: 'HHZ Editorial' }],
    tags,
    language: 'en-IN',
  };
}

function cityFeedItems(site: URL): JsonFeedItem[] {
  return cityPages.flatMap((page) => {
    const base = makeJsonFeedItem(
      site,
      `/oxygen-concentrators/5-lpm/${page.slug}/`,
      page.title,
      page.description,
      ['oxygen-concentrator', '5-lpm', page.slug, 'city-buying-guide']
    );

    const intents = cityIntentLabels.map(([intent, titlePrefix, titleSuffix]) =>
      makeJsonFeedItem(
        site,
        `/oxygen-concentrators/${intent}/${page.slug}/`,
        `${titlePrefix} in ${page.city}: ${titleSuffix}`,
        `City-specific oxygen concentrator ${intent} guide for ${page.city}: Home Medix and Oxymed positioning, imported-brand checks, warranty, spares, stock age, invoice proof, and service route verification.`,
        ['oxygen-concentrator', intent, page.slug, 'city-buying-guide']
      )
    );

    return [base, ...intents];
  });
}

export const GET: APIRoute = async (context: APIContext) => {
  const site = context.site ?? new URL('https://homehealthzone.com/');

  const guides = await getCollection('guides');
  const clinical = await getCollection('clinical');

  const contentItems: JsonFeedItem[] = [...guides, ...clinical]
    .map((entry) => {
      const slug = entry.id.replace(/\.(md|mdx)$/, '');
      const collection = entry.collection as 'guides' | 'clinical';
      const url = new URL(`/${collection}/${slug}/`, site).toString();
      return {
        id: url,
        url,
        title: entry.data.title,
        content_text: entry.data.description,
        summary: entry.data.description,
        date_published: safeISO(entry.data.lastReviewed),
        date_modified: safeISO(entry.data.lastReviewed),
        authors: [{ name: entry.data.author || 'HHZ Editorial' }],
        tags: entry.data.tags ?? [],
        language: 'en-IN',
      };
    });

  const curatedItems = curatedBuyerPages.map((item) =>
    makeJsonFeedItem(site, item.path, item.title, item.description, item.tags)
  );

  const items = [...contentItems, ...curatedItems, ...cityFeedItems(site)].sort(
    (a, b) =>
      new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
  );

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_NAME,
    home_page_url: site.toString(),
    feed_url: new URL('/feed.json', site).toString(),
    description: SITE_DESCRIPTION,
    language: 'en-IN',
    authors: [{ name: 'HHZ Editorial' }],
    items,
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
    },
  });
};
