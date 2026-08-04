# AI-search visibility playbook

Home Health Zone should optimize for being the most useful, extractable source in each respiratory topic—not for repeating every surface form of a query. Search and answer systems consolidate semantically similar language, so one strong page should cover the full decision or question cluster with explicit entities, a concise answer, supporting detail, FAQs, sources, and clear update metadata.

The canonical mapping for commercial retrieval is `data/commercial-search-rewrite-map.csv`. It records 100 user-language prompts, the likely targeted search rewrite, and the existing HHZ URL that owns the intent. The smaller `data/ai-search-prompt-matrix.csv` is the recurring high-priority monitoring sample; it is not the complete keyword universe.

## Publishing rules

1. Map each new phrase to an existing canonical page before creating anything. Improve that page when the searcher's underlying task is the same; create a new page only when the decision, audience, or required evidence is materially different.
2. Put a direct, self-contained answer near the top. State the product class or clinical concept, India context, key constraint, and recommendation boundary in language that remains accurate when quoted alone.
3. Add FAQs only for genuinely distinct follow-up questions. They should clarify the answer, not mechanically restate keywords.
4. Link to four semantically related pages. Prefer a logical path from explanation → selection criteria → comparison/ranking → product or service page.
5. Keep canonical URLs stable. If a page must move, add a permanent redirect and update internal links, sitemaps, feeds, LLM indexes, and datasets.
6. Publish honest provenance. A known publication date is distinct from last reviewed and last modified. Never imply medical review without a named qualified reviewer.
7. Cite primary guidelines, standards, manufacturers, or original research for claims that change clinical or purchasing decisions.
8. Validate the rewrite map after a build with `npm run semantic:validate`. Every rewrite must resolve to one live canonical target; changing a target requires updating internal links and the monitoring matrix.

## Retrieval surfaces

- HTML pages remain canonical and contain the complete context.
- `sitemap-index.xml`, RSS, and JSON Feed expose discovery and dates.
- `llms.txt`, topic text corpora, and the public datasets expose compact, machine-readable indexes.
- `robots.txt` permits major search and answer-system crawlers.
- The deploy workflow submits changed canonical URLs to IndexNow after a successful production deploy.

## Weekly operating loop

1. Export Bing AI Search Queries and AI Page Stats CSV files.
2. Generate the scorecard:

   ```sh
   npm run ai:report -- \
     --queries /path/to/AISearchQueriesReport.csv \
     --pages /path/to/AIPageStatsReport.csv \
     --out reports/ai-visibility/YYYY-MM-DD \
     --date YYYY-MM-DD
   ```

3. Compare query-cluster citation volume, HHZ citation share, page-section share, and top-page concentration with the previous export.
4. Run the prompt matrix on the answer systems that matter. Record date, surface, cited HHZ URL, rank/order, and competitor sources. Repeat high-value prompts because individual answers vary.
5. Protect winners first. Upgrade a cited page's answer, evidence, FAQs, and semantic links before adding a new URL.
6. Review low-share commercial clusters. Diagnose missing evidence, weak product specificity, unclear India context, or an intent mismatch.
7. After changes deploy, confirm the canonical page, sitemap last-modified date, dataset record, LLM corpus entry, and IndexNow workflow run.

## Measures that matter

- Citation share by commercial and clinical query cluster
- Number of distinct cited HHZ canonical URLs
- Share of citations earned by commercial pages versus clinical/reference pages
- Top-10 and top-20 citation concentration
- Citation persistence for priority pages over four consecutive exports
- Correct citation: whether the cited page actually supports the generated claim

LLM caches and answer indexes are not directly controllable. The practical strategy is stable canonical URLs, extractable facts, useful updates, reliable discovery signals, and enough distinctive first-party evidence that refreshing the source improves the answer.
