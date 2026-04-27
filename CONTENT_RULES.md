# HHZ Content Rules (shared across all writing agents)

Read this before writing any HHZ article. Every rule is non-negotiable.

## Byline

- Every article has `author: "HHZ Editorial"` in frontmatter.
- Do NOT add `reviewedBy` or `credentials` fields. Do NOT invent individual reviewer names (no "Dr. A Sharma", no "MBBS MD Pulmonology").
- Body text never attributes opinions to named individuals. Use "HHZ" / "our editorial review" / assert the point.

## Oxygentimes is INVISIBLE

- **Never mention oxygentimes.com, "oxygentimes", "oxygen times"** — anywhere, ever. Not in body, not in sources, not in passing.
- If you must reference spec provenance, the exact phrase is: *"manufacturer brochures and e-commerce product listings"*.
- If you need to say "other review sites rank this", don't — make your own case.

## No invented specs

- Only reference products that exist as JSON files in `~/hhz-site/src/content/products/` or `~/hhz-site/src/content/cpap-bipap/`.
- Read the JSON before quoting any spec number (price, weight, flow, noise, warranty). The fields `key_features`, `spec_tables`, `price_current`, `price_mrp`, `stock`, `rating_value` are the source of truth for that product.
- If a number isn't in the JSON, don't quote one.
- Product names must match the JSON's `product_name` exactly.

## Bench data and teardown

- HHZ runs destructive teardown + performance bench testing on loaner units. Full protocol at `/methodology/`.
- **Bench-data claims** (`we measured`, `our bench`, `our teardown`, `HHZ bench data`) are allowed ONLY when the claim is backed by a real measurement or teardown finding on that specific unit. The review must carry a "Loaner unit destructively tested" disclosure at the top.
- **Paper-spec reviews** (no loaner access) must continue to frame all performance statements as "per published spec", "manufacturer claim", or "in the field" (plausible field lore, not a measurement). Mark the review header with "Paper-spec review — no teardown" so readers know which tier of claim they're reading.
- Do not retrofit bench-data or teardown language into existing reviews that were written as paper-spec. Republish the review with a proper Teardown section only after the unit has actually been through the protocol.
- Teardown findings (zeolite charge, valve material, FTIR ID, sensor type, voltage-stress result, etc.) must match what was actually observed. Never invent teardown numbers — a teardown finding is the highest-trust claim on the site.

## Home Medix is just another brand

- Home Medix SKUs in the catalogue (HM-KV 5 LPM, HM-KX 10 LPM, HM-CV-20 CPAP, HM-BV-30 BiPAP, HM Pro nebulizer, MistyNeb nebulizer) are reviewed and compared against competitors with strict neutrality.
- No inside-knowledge tone, no "we know their design", no ownership framing.
- Never feature a Home Medix product on its own; always include it alongside comparable brands.

## No editorial-status framing in either direction

- Do NOT describe HHZ as "independent", "an independent editorial publication", "an independent reference", or any equivalent self-descriptor of editorial independence.
- Do NOT include disclaimer language like "no free product accepted", "no sponsored placement", "no brand veto", or "no commercial relationship with the brands named". Even where literally true in narrow scope, these phrases imply a structural arms-length relationship across the catalogue and are not used.
- Do NOT mention a parent company, sponsor, commercial relationship, or editorial tie-in either. No ownership disclosure, no COI callouts, no disclosure banners.
- The framing is neutral: HHZ catalogues respiratory equipment sold in India and scores it against a published rubric. That is the only editorial claim. Do not extend it in either direction.
- The word "independent" remains acceptable in its non-self-descriptor senses: clinical / epidemiological ("independent risk factor"), architectural ("two independent flowmeters"), dealer-network ("independent biomed shops"), or third-party ("independently validated against benchmarks"). Only block it as an HHZ self-descriptor.

## Price framing

- Prices come from scraped e-commerce listings (don't name the source). Format as Indian rupees with comma separators (₹43,699).
- When quoting current price, frame it as "indicative retail, roughly ₹X in 2026" or "typically around ₹X street price" — never "we tested", never "MRP confirmed".
- MRP (if in JSON as `price_mrp`) can be quoted as "listed MRP ₹X".

## Indian-market context throughout

Every article references India-specific realities where relevant:

- Rupee pricing with Indian formatting.
- 220V / 50Hz mains with real voltage variance (some Tier-2 cities see 160–260V range — stabiliser / UPS / pure-sine inverter decisions follow).
- CDSCO regulatory status (note if shown in JSON's `Additional details`).
- State-wise electricity tariff implications for 24/7 concentrator use.
- Altitude derating for Indian hill stations: Leh (~3500m), Manali (~2050m), Gangtok (~1600m), Darjeeling (~2000m), Shimla (~2200m), Ooty (~2200m), Munnar (~1500m), Mussoorie (~2000m), Srinagar (~1600m).
- Service network realism per brand — Oxymed / BPL / Philips have broader dealer presence than most Chinese OEMs; Inogen / ResMed premium brands have urban-only service.
- Indian Railways oxygen-carriage policies, IndiGo / Air India / foreign carrier POC approvals for international travel.
- Humidity zones — coastal (Mumbai, Chennai, Kochi, Kolkata, Visakhapatnam) stresses CPAP tubing/mask wear and concentrator filter cycles.
- GST implications (12% on medical devices in most cases), hospital-channel vs online-channel markup patterns.

## Citation markers

Use `[CITATION: specific description of the source]` inline wherever a primary source would belong. Examples:

- `[CITATION: GOLD 2024 guidelines, section on LTOT indications]`
- `[CITATION: AASM scoring manual v3.0, section on hypopnea]`
- `[CITATION: BTS/ATS statement on home NIV, 2022]`
- `[CITATION: Masa JF et al, Lancet 2019 — Pickwick trial]`
- `[CITATION: Murphy PB et al, JAMA 2017 — home NIV for hypercapnic COPD]`
- `[CITATION: Indian Chest Society COPD consensus, 2021]`
- `[CITATION: CDSCO medical-device registry lookup — manufacturer X]`

Do NOT fabricate real citations. The marker says "something goes here"; a human editor fills it in later.

## Take positions

- Every article closes with a firm recommendation or verdict.
- No "it depends on many factors" hedging. Pick a stance grounded in the published specs.
- Qualifiers like "consult your physician before starting therapy" are fine — appear at most once per clinical article, near the end.

## Voice

- Technical, dense, datasheet-flavored.
- 2–4 sentence paragraphs. No wall-of-text.
- H2/H3 structure. Lead each section with the specific, follow with the general.
- Monospace-appropriate numerics in spec contexts (the site CSS renders spec tables in mono with tabular-nums).
- Short sentences where a short sentence is enough.

## Output process

1. Read this file.
2. Read `~/hhz-site/CONVENTIONS.md` for positioning + URL structure.
3. For each article you're writing, read the referenced product JSONs first.
4. Write the MDX file at the exact path in your task brief.
5. Return a short summary (≤200 words): file paths + word counts + any skipped items. Do NOT paste article bodies in your response. Do NOT run `npm run build` or any Astro commands.
