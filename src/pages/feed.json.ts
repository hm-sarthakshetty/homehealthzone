import { getCollection } from 'astro:content';
import type { APIContext, APIRoute } from 'astro';

const SITE_NAME = 'HHZ Respiratory Review';
const SITE_DESCRIPTION =
  'Independent editorial reviews of oxygen concentrators, CPAP, BiPAP, and respiratory equipment sold in India.';

function safeISO(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const GET: APIRoute = async (context: APIContext) => {
  const site = context.site ?? new URL('https://homehealthzone.com/');

  const guides = await getCollection('guides');
  const clinical = await getCollection('clinical');

  const items = [...guides, ...clinical]
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
    })
    .sort(
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
