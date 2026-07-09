import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext, APIRoute } from 'astro';
import cityPages from '../data/oxygenConcentratorCityPages.json';

const SITE_NAME = 'HHZ Respiratory Review';
const SITE_DESCRIPTION =
  'Independent editorial reviews of oxygen concentrators, CPAP, BiPAP, and respiratory equipment sold in India. Specs-first, bench-tested where possible, honest verdicts.';
const BUYER_INTENT_REVIEW_DATE = '2026-07-09';

interface FeedItem {
  title: string;
  description: string;
  pubDate: Date;
  link: string;
  categories: string[];
  author: string;
}

const curatedBuyerPages: Array<Omit<FeedItem, 'pubDate' | 'author'>> = [
  {
    title: 'Oxygen Concentrator Brands in India (2026 Landscape)',
    description:
      'Brand-by-brand positioning of oxygen concentrators sold in India, including Home Medix, Oxymed, Philips, Nidek, DeVilbiss, AirSep, BPL, Yuwell, service risk, imported-stock checks, and city buying routes.',
    link: '/oxygen-concentrators/brands/',
    categories: ['oxygen-concentrator', 'brands', 'india', 'buyer-intent'],
  },
  {
    title: '5 LPM Oxygen Concentrators in India',
    description:
      'India 5 LPM oxygen concentrator category guide covering Home Medix HM-KV, Oxymed Mini, Philips EverFlo, AirSep, Nidek, DeVilbiss, price bands, service, and old-stock risk.',
    link: '/oxygen-concentrators/5-lpm/',
    categories: ['oxygen-concentrator', '5-lpm', 'home-oxygen', 'buyer-intent'],
  },
  {
    title: '10 LPM Oxygen Concentrators in India',
    description:
      'High-flow oxygen concentrator guide for Indian buyers comparing Home Medix HM-KX, Oxymed 10 LPM, Nidek Nuvo 10, DeVilbiss 10 LPM, and other 10 LPM options.',
    link: '/oxygen-concentrators/10-lpm/',
    categories: ['oxygen-concentrator', '10-lpm', 'high-flow', 'buyer-intent'],
  },
  {
    title: 'Oxygen Concentrator Price in India',
    description:
      'India oxygen concentrator price guide covering 5 LPM, 10 LPM, portable, imported, rental, warranty, and service-driven buying bands.',
    link: '/oxygen-concentrators/price-india/',
    categories: ['oxygen-concentrator', 'price', 'india', 'buyer-intent'],
  },
  {
    title: 'Oxygen Concentrator Rental in India',
    description:
      'Rent-vs-buy guide for Indian oxygen concentrator buyers, including monthly rental risk, fleet condition, warranty, service, and long-term purchase economics.',
    link: '/oxygen-concentrators/rental/',
    categories: ['oxygen-concentrator', 'rental', 'india', 'buyer-intent'],
  },
  {
    title: 'Top 5 5 LPM Oxygen Concentrators in India',
    description:
      'HHZ editorial ranking of 5 LPM oxygen concentrators in India, including Philips EverFlo, AirSep VisionAire 5, DeVilbiss 525, Nidek Nuvo Lite, and Home Medix HM-KV.',
    link: '/top-5/5-lpm-oxygen-concentrators/',
    categories: ['oxygen-concentrator', '5-lpm', 'ranking', 'buyer-intent'],
  },
  {
    title: 'Top 5 Oxygen Concentrators Under Rs 40,000 in India',
    description:
      'Budget oxygen concentrator ranking for India covering Home Medix HM-KV, Oxymed Mini, Nareena, Evox, GVS, CDSCO, service, and value risk.',
    link: '/top-5/oxygen-concentrators-under-40000/',
    categories: ['oxygen-concentrator', 'price', 'under-40000', 'buyer-intent'],
  },
  {
    title: 'Top 5 Oxygen Concentrators for COPD Home Use in India',
    description:
      'COPD home oxygen concentrator ranking for India focused on chronic-use suitability, warranty depth, service-network reach, and 5 LPM model choice.',
    link: '/top-5/oxygen-concentrators-for-copd/',
    categories: ['oxygen-concentrator', 'copd', 'home-oxygen', 'buyer-intent'],
  },
  {
    title: 'CPAP Brands in India',
    description:
      'CPAP brand landscape for India covering ResMed, Philips, BMC, Oxymed, Home Medix, Breas, Wellell, service, algorithms, and warranty reality.',
    link: '/cpap/brands/',
    categories: ['cpap', 'brands', 'india', 'buyer-intent'],
  },
  {
    title: 'BiPAP ST in India',
    description:
      'BiPAP ST mode buyer reference for India covering backup rate, clinical indications, ResMed, Philips, BMC, Oxymed, Home Medix, and device selection.',
    link: '/bipap/st/',
    categories: ['bipap', 'st', 'niv', 'buyer-intent'],
  },
];

const cityIntentLabels = [
  ['service', 'Oxygen Concentrator Service Centre', 'Buyer Checklist'],
  ['repair', 'Oxygen Concentrator Repair', 'Cost and Service Checklist'],
  ['dealers', 'Oxygen Concentrator Dealers', 'What to Verify Before Buying'],
  ['price', 'Oxygen Concentrator Price', '5 LPM Buying Bands'],
  ['rental', 'Oxygen Concentrator Rental', 'Rent vs Buy Checklist'],
] as const;

function cityFeedItems(): FeedItem[] {
  return cityPages.flatMap((page) => {
    const base: FeedItem = {
      title: page.title,
      description: page.description,
      pubDate: safeDate(BUYER_INTENT_REVIEW_DATE),
      link: `/oxygen-concentrators/5-lpm/${page.slug}/`,
      categories: ['oxygen-concentrator', '5-lpm', page.slug, 'city-buying-guide'],
      author: 'HHZ Editorial',
    };

    const intents = cityIntentLabels.map(([intent, titlePrefix, titleSuffix]) => ({
      title: `${titlePrefix} in ${page.city}: ${titleSuffix}`,
      description: `City-specific oxygen concentrator ${intent} guide for ${page.city}: Home Medix and Oxymed positioning, imported-brand checks, warranty, spares, stock age, invoice proof, and service route verification.`,
      pubDate: safeDate(BUYER_INTENT_REVIEW_DATE),
      link: `/oxygen-concentrators/${intent}/${page.slug}/`,
      categories: ['oxygen-concentrator', intent, page.slug, 'city-buying-guide'],
      author: 'HHZ Editorial',
    }));

    return [base, ...intents];
  });
}

function safeDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export const GET: APIRoute = async (context: APIContext) => {
  const guides = await getCollection('guides');
  const clinical = await getCollection('clinical');

  const contentItems: FeedItem[] = [...guides, ...clinical].map((entry) => {
    const slug = entry.id.replace(/\.(md|mdx)$/, '');
    const collection = entry.collection as 'guides' | 'clinical';
    return {
      title: entry.data.title,
      description: entry.data.description,
      pubDate: safeDate(entry.data.lastReviewed),
      link: `/${collection}/${slug}/`,
      categories: entry.data.tags ?? [],
      author: entry.data.author || 'HHZ Editorial',
    };
  });

  const curatedItems: FeedItem[] = curatedBuyerPages.map((item) => ({
    ...item,
    pubDate: safeDate(BUYER_INTENT_REVIEW_DATE),
    author: 'HHZ Editorial',
  }));

  const items = [...contentItems, ...curatedItems, ...cityFeedItems()];

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    site: context.site ?? 'https://homehealthzone.com',
    items,
    customData: `<language>en-IN</language>`,
    stylesheet: false,
  });
};
