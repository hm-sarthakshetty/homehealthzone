import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const SITE = 'https://homehealthzone.com';

function slugOf(id: string): string {
  return id.replace(/\.(md|mdx|json)$/, '');
}

export const GET: APIRoute = async () => {
  const [oxygen, pap, oxygenReviews, papReviews] = await Promise.all([
    getCollection('products'),
    getCollection('cpap-bipap'),
    getCollection('product-reviews'),
    getCollection('cpap-bipap-reviews'),
  ]);

  const reviewMap = new Map(
    [...oxygenReviews, ...papReviews].map((entry) => [slugOf(entry.id), entry.data])
  );

  const records = [...oxygen, ...pap]
    .map((entry) => {
      const slug = entry.data.slug || slugOf(entry.id);
      const review = reviewMap.get(slug);
      const isPap = entry.collection === 'cpap-bipap';
      const canonicalPath = isPap
        ? `/${entry.data.device_type === 'bipap' ? 'bipap' : 'cpap'}/${slug}/`
        : `/oxygen-concentrators/${slug}/`;

      return {
        id: slug,
        canonical_url: `${SITE}${canonicalPath}`,
        product_name: entry.data.product_name,
        brand: entry.data.brand || null,
        category: entry.data.category || null,
        device_type: 'device_type' in entry.data ? entry.data.device_type : 'oxygen-concentrator',
        price: {
          current: entry.data.price_current ?? null,
          mrp: entry.data.price_mrp ?? null,
          currency_symbol: entry.data.price_symbol || '₹',
        },
        stock_text: entry.data.stock || null,
        normalized_specs: entry.data.normalized_specs,
        source_url: entry.data.source_url,
        review: review
          ? {
              url: `${SITE}${canonicalPath}`,
              score: review.score ?? null,
              verdict: review.verdict ?? null,
              author: review.author,
              last_reviewed: review.lastReviewed,
              date_modified: review.dateModified ?? review.lastReviewed,
            }
          : null,
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));

  const modifiedDates = records
    .map((record) => record.review?.date_modified)
    .filter((date): date is string => Boolean(date))
    .sort();

  return new Response(
    JSON.stringify(
      {
        schema_version: '1.0',
        name: 'HHZ respiratory product dataset',
        publisher: {
          name: 'Home Health Zone',
          url: `${SITE}/`,
        },
        methodology_url: `${SITE}/methodology/`,
        terms_url: `${SITE}/datasets/`,
        latest_content_date: modifiedDates.at(-1) ?? null,
        record_count: records.length,
        records,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
};
