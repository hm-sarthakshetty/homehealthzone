# Prompt to continue HHZ site build in a fresh Claude Code session

Paste the block below as your first message in a new session.

---

```
I'm continuing a content-build for HomeHealthZone.com (HHZ), an Astro site at ~/hhz-site/. The plan is at /Users/sarthakshetty/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeCode/otkiller/hhz-plan.md. The scraped mirror data (source for product specs) is at ~/hhz-scrape/oxygentimes-mirror/.

## State as of last session (2026-04-23)

Infrastructure is done. Build passes. 193+ pages. Interactive browse + compare, spec filters, SEO (robots.txt, llms.txt, llms-full.txt, sitemap, RSS + JSON feeds), schema markup, image optimization (AVIF/WebP).

Content shipped this session:
- 16 pillar MDX pages at src/pages/oxygen-concentrators/{5-lpm,10-lpm,portable,dual-flow,adjustable-purity,brands,rental,price-india}.mdx and src/pages/cpap/{apap,fixed-pressure,brands,rental,price-india}.mdx and src/pages/bipap/{st,auto-st,tvaps}.mdx
- ~81 concentrator product reviews in src/content/product-reviews/*.mdx
- 25 CPAP/BiPAP product reviews in src/content/cpap-bipap-reviews/*.mdx
- ~40 comparison writeups in src/content/comparison-writeups/*.mdx
- 5 seed guides + 5 seed clinical articles from earlier work

Remaining:
- H4 (10 comparison writeups, matchups ranked 31–40 by `comparison_score`)
- I1–I6 (~50 clinical articles): PSA chemistry, Indian-context clinical, clinical indications, equipment operation, sleep/CPAP clinical, market/regulatory

Plan Group G (nebulizers) is DROPPED entirely. Plan Groups J (city pages) and K (data pages) are DEFERRED.

## Hard rules (non-negotiable — violated once and user will notice)

1. **Byline only "HHZ Editorial".** Never invent reviewer names like "Dr. A Sharma". No `reviewedBy` or `credentials` fields anywhere.
2. **NEVER mention oxygentimes.com / "oxygentimes" / "oxygen times" anywhere** — not in body, not in sources, not in passing. Spec provenance phrasing is "manufacturer brochures and e-commerce product listings".
3. **Home Medix (HM-KV, HM-KX, HM-CV-20, HM-BV-30, HM Pro, MistyNeb) is reviewed like any other brand.** No inside-knowledge tone, no ownership disclosure, no preferential framing.
4. **No affiliation disclosures whatsoever.** HHZ is presented as fully independent.
5. **Price disclaimer copy is "Indicative pricing based on market intelligence. Varies by dealer, city, bundle, and period…"** — NOT "sampled from one dealer".
6. **No bench data claims.** HHZ hasn't run bench tests. All performance is "published spec" or "manufacturer claim".
7. **No invented specs or model numbers.** Only reference products that exist as JSON files in src/content/products/ or src/content/cpap-bipap/.
8. **Indian context throughout** — rupees, 220V/50Hz tolerance, CDSCO, stabiliser/UPS realities, altitude for Indian hill stations, service network per brand, GST.
9. **Citation markers `[CITATION: description]` inline** where a primary source would go. Don't fabricate real citations.
10. **Take positions.** No "it depends" hedging. Every article closes with a firm recommendation.

## Voice

Technical, dense, datasheet-flavored. 2–4 sentence paragraphs. H2/H3 structure. Rupee figures in Indian format (₹43,699). Tabular specs where possible.

## Task

Spawn parallel content-writing agents to finish the remaining content:
- 1 agent for H4 (10 comparison writeups, matchups ranked 31–40 by `comparison_score` in src/content/comparisons/*.json). MDX files at src/content/comparison-writeups/<slug>.mdx.
- 6–7 agents for clinical articles (Group I of plan, ~50 articles across PSA chemistry, Indian-context, clinical indications, equipment operation, sleep/CPAP clinical part 1, sleep/CPAP clinical part 2, market/regulatory). MDX files at src/content/clinical/<slug>.mdx.

For each agent, read ~/hhz-site/CONTENT_RULES.md (shared rules doc) and reference it in the brief instead of duplicating. Be specific about file paths + frontmatter schema + word counts.

After agents return, run `npm run build` to catch schema / slug issues, fix them, report.

Shared content rules are at ~/hhz-site/CONTENT_RULES.md. Content collection schemas are at ~/hhz-site/src/content.config.ts.
```

---

Save this file as /Users/sarthakshetty/hhz-site/RESUME_PROMPT.md. When starting a fresh session, open this file and paste the fenced block above into the new chat.
