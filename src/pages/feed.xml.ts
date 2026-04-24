import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext, APIRoute } from 'astro';

const SITE_NAME = 'HHZ Respiratory Review';
const SITE_DESCRIPTION =
  'Independent editorial reviews of oxygen concentrators, CPAP, BiPAP, and respiratory equipment sold in India. Specs-first, bench-tested where possible, honest verdicts.';

function safeDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export const GET: APIRoute = async (context: APIContext) => {
  const guides = await getCollection('guides');
  const clinical = await getCollection('clinical');

  const items = [...guides, ...clinical].map((entry) => {
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
