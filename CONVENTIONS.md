# HHZ Site — Conventions (read this before writing code)

Internal reference for agents building the HHZ Astro site at `~/hhz-site/`.

## Positioning (load-bearing — do not deviate)

- Publication name: **HHZ Respiratory Review**
- Positioning: independent editorial publication reviewing respiratory equipment sold in India
- **No ownership or commercial affiliation is disclosed anywhere.** Do not reference Home Medix as a parent company, owner, sponsor, or affiliate. No disclosure banners, no COI callouts.
- Home Medix products (model names: HM-KV, HM-KX, HM-CV-20, HM-BV-30, HM Pro, MistyNeb) are reviewed like any other brand using the published rubric.
- No free product accepted, no sponsored placement, no brand veto — the editorial-independence statement lives at `/editorial-policy/`.

## URL structure (trailing-slash required via astro.config.mjs)

| Path | Purpose |
| --- | --- |
| `/` | homepage |
| `/oxygen-concentrators/` | concentrators hub |
| `/oxygen-concentrators/{slug}/` | single concentrator review |
| `/cpap/` | CPAP hub |
| `/cpap/{slug}/` | single CPAP review |
| `/bipap/` | BiPAP hub |
| `/bipap/{slug}/` | single BiPAP review |
| `/compare/` | comparisons index |
| `/compare/{slug}/` | head-to-head comparison page |
| `/guides/` | guides index |
| `/guides/{slug}/` | guide article (MDX) |
| `/clinical/` | clinical articles index |
| `/clinical/{slug}/` | clinical article (MDX) |
| `/about/`, `/methodology/`, `/editorial-policy/`, `/correction-policy/`, `/privacy-policy/`, `/terms/`, `/contact/` | policy pages |

All internal links must end in `/`.

## Content collections (defined in `src/content.config.ts`)

- `products` (data, JSON, in `src/content/products/*.json`) — oxygen concentrators
- `cpap-bipap` (data, JSON, in `src/content/cpap-bipap/*.json`) — CPAP + BiPAP; has `device_type: 'cpap' | 'bipap'` controlling which route renders it
- `comparisons` (data, JSON, in `src/content/comparisons/*.json`) — top 50 head-to-head matchups
- `guides` (content, MDX, in `src/content/guides/*.mdx`) — buyer's guides
- `clinical` (content, MDX, in `src/content/clinical/*.mdx`) — clinical / educational articles

Use `getCollection('<name>')` to list entries, `getEntry('<name>', slug)` for single lookup.

## Layouts (`src/layouts/`)

- `BaseLayout.astro` — HTML shell, head meta, Nav, Footer. Every page wraps in this.
- `ProductLayout.astro` — for product reviews (wraps BaseLayout, adds Product JSON-LD + Breadcrumbs).
- `ArticleLayout.astro` — for guides & clinical articles (wraps BaseLayout, adds Article JSON-LD + author/date meta).
- `ComparisonLayout.astro` — for `/compare/` pages (wraps BaseLayout, renders side-by-side).

## Reusable components (`src/components/`)

UI:
- `Nav.astro`, `Footer.astro`, `Breadcrumbs.astro`
- `SpecTable.astro` — renders `spec_tables` dict
- `FAQSection.astro` — renders `faqs` array + FAQPage JSON-LD
- `PriceBadge.astro` — renders price_current / price_mrp with ₹
- `ProductCard.astro` — grid-item thumbnail for products
- `ArticleCard.astro` — grid-item for guides/clinical
- `RelatedProducts.astro` — list of related product cards
- `ComparisonTable.astro` — side-by-side spec comparison for 2 products

JSON-LD schema (emit `<script type="application/ld+json">`):
- `SchemaProduct.astro`, `SchemaArticle.astro`, `SchemaFAQ.astro`, `SchemaBreadcrumb.astro`, `SchemaOrganization.astro`, `SchemaMedicalWebPage.astro`

## CSS / Design

- `src/styles/global.css` imported once in `BaseLayout.astro`
- Design tokens via CSS custom properties (`--color-*`, `--font-*`, `--space-*`)
- Fonts: **serif** (Source Serif / Georgia fallback) for body, **sans** (Inter / system) for UI & headings
- Colors: warm neutrals — `#fdfcfa` bg, `#1a1a1a` text, `#c2410c` rust accent. Deliberately not medical blue/green.
- Mobile-first responsive, single URL design.

## Accessibility

- Semantic HTML5 (header, nav, main, article, aside, footer).
- Alt text on every image.
- Keyboard-visible focus states.
- WCAG AA contrast minimum.

## Images

- Product images served at `/images/products/{safe-filename}.jpg` (symlinked from scraped data).
- The `images[].src` field in content records is already the local `/images/products/...` path.

## Do

- Use Astro's built-in `<a href="/path/">` with trailing slash.
- Use `Astro.url.pathname` and `Astro.site` for canonical URLs.
- Use `getCollection` / `getEntry` for content access.
- Semantic `<time>`, `<address>`, `<figure>` etc. where appropriate.

## Don't

- Don't use client-side JavaScript unless strictly necessary. Keep pages static.
- Don't reference Home Medix as "our" product, "in-house", or imply ownership.
- Don't invent products not in the content collections.
- Don't use inline styles for anything reusable.
- Don't hardcode `https://homehealthzone.com` — use `Astro.site`.
