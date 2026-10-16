/** Static index: India device reviews, buying guides and clinical articles; regional guides. */
import type { APIRoute } from 'astro';
import { getSearchIndex } from '../lib/search-index';

export const GET: APIRoute = async () => new Response(JSON.stringify(await getSearchIndex()), {
  headers: { 'Content-Type': 'application/json' },
});
