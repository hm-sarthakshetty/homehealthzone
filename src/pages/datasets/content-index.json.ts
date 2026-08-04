import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const SITE = 'https://homehealthzone.com';

export const GET: APIRoute = async () => {
  const [guides, clinical] = await Promise.all([
    getCollection('guides'),
    getCollection('clinical'),
  ]);

  const records = [...guides, ...clinical]
    .map((entry) => {
      const slug = entry.id.replace(/\.(md|mdx)$/, '');
      return {
        id: `${entry.collection}:${slug}`,
        collection: entry.collection,
        canonical_url: `${SITE}/${entry.collection}/${slug}/`,
        title: entry.data.title,
        description: entry.data.description,
        tags: entry.data.tags,
        concise_answer: entry.data.answer ?? null,
        faqs: entry.data.faqs,
        author: entry.data.author ?? 'HHZ Editorial',
        reviewed_by: entry.data.reviewedBy ?? null,
        credentials: entry.data.credentials ?? null,
        date_published: entry.data.datePublished ?? null,
        last_reviewed: entry.data.lastReviewed ?? null,
        date_modified: entry.data.dateModified ?? entry.data.lastReviewed ?? null,
      };
    })
    .sort((a, b) => a.canonical_url.localeCompare(b.canonical_url));

  const modifiedDates = records
    .map((record) => record.date_modified)
    .filter((date): date is string => Boolean(date))
    .sort();

  return new Response(
    JSON.stringify(
      {
        schema_version: '1.0',
        name: 'HHZ respiratory editorial content index',
        publisher: {
          name: 'Home Health Zone',
          url: `${SITE}/`,
        },
        editorial_policy_url: `${SITE}/editorial-policy/`,
        corrections_policy_url: `${SITE}/correction-policy/`,
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
