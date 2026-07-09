#!/usr/bin/env python3
"""Generate public/llms.txt and public/llms-full.txt for LLM ingestion.

Pulls:
  - src/content/guides/*.mdx
  - src/content/clinical/*.mdx
  - Policy pages (methodology, editorial-policy, correction-policy, about)
    via reading from src/pages/*.astro and stripping Astro syntax

Output format follows the llms-full.txt convention: plain markdown, separated
by horizontal rules, with page source paths as comments at the top of each section.
"""
from __future__ import annotations

import re
import sys
import json
from pathlib import Path

SITE = Path.home() / "hhz-site"
OUT_INDEX = SITE / "public" / "llms.txt"
OUT_FULL = SITE / "public" / "llms-full.txt"

SITE_URL = "https://homehealthzone.com"


def strip_frontmatter(md: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body_markdown). Cheap YAML parser, one-level only."""
    if not md.startswith("---\n"):
        return ({}, md)
    end = md.find("\n---\n", 4)
    if end == -1:
        return ({}, md)
    fm_text = md[4:end]
    body = md[end + 5 :].lstrip()

    fm: dict = {}
    for line in fm_text.splitlines():
        m = re.match(r"^(\w+):\s*(.*)$", line)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        fm[key] = value
    return (fm, body)


def extract_astro_text(astro_src: str) -> str:
    """Roughly strip Astro/JSX to plain text. Conservative — this is only a
    fallback for policy pages without structured content."""
    # Remove frontmatter block
    m = re.match(r"^---\n.*?\n---\n", astro_src, re.DOTALL)
    if m:
        astro_src = astro_src[m.end():]
    # Remove <style>...</style>
    astro_src = re.sub(r"<style[^>]*>.*?</style>", "", astro_src, flags=re.DOTALL)
    # Remove <script>...</script>
    astro_src = re.sub(r"<script[^>]*>.*?</script>", "", astro_src, flags=re.DOTALL)
    # Keep H1/H2/H3/H4 as markdown headings
    astro_src = re.sub(
        r"<h([1-6])[^>]*>([\s\S]*?)</h\1>",
        lambda m: "\n" + "#" * int(m.group(1)) + " " + re.sub(r"<[^>]+>", "", m.group(2)).strip() + "\n",
        astro_src,
    )
    # <li> -> "- "
    astro_src = re.sub(r"<li[^>]*>([\s\S]*?)</li>", r"- \1\n", astro_src)
    # <p> -> paragraph
    astro_src = re.sub(r"<p[^>]*>([\s\S]*?)</p>", r"\1\n\n", astro_src)
    # Strip any remaining tags
    astro_src = re.sub(r"<[^>]+>", "", astro_src)
    # Collapse 3+ blank lines
    astro_src = re.sub(r"\n{3,}", "\n\n", astro_src)
    return astro_src.strip()


_CITATION_RE = re.compile(r"\s*\[CITATION:[^\]]*\]")


def strip_citations(body: str) -> str:
    """Remove [CITATION: ...] editorial markers from the body text.

    Source MDX files keep markers for future editorial backfill; the rendered
    site already resolves credible sources to real links via the
    remark-resolve-citations plugin. The llms-full.txt corpus gets markers
    stripped wholesale — LLM retrievers can follow real links on the rendered
    HTML; the placeholder markers would just be noise in the corpus.
    """
    # Collapse backtick-wrapped citations: `[CITATION: ...]` → ''
    body = re.sub(r"`\s*\[CITATION:[^\]]*\]\s*`", "", body)
    # Bare citations: [CITATION: ...] with any preceding whitespace
    body = _CITATION_RE.sub("", body)
    return body


def section(url: str, title: str, body: str) -> str:
    return (
        f"# {title}\n\n"
        f"Source: {url}\n\n"
        f"{strip_citations(body).strip()}\n\n"
        "---\n\n"
    )


def read_mdx_sections(dir_path: Path, url_prefix: str) -> list[str]:
    sections: list[str] = []
    for f in sorted(dir_path.glob("*.mdx")):
        md = f.read_text(encoding="utf-8")
        fm, body = strip_frontmatter(md)
        title = fm.get("title") or f.stem.replace("-", " ").title()
        slug = f.stem
        url = f"{SITE_URL}{url_prefix}{slug}/"
        sections.append(section(url, title, body))
    return sections


def content_entries(dir_path: Path, url_prefix: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for f in sorted(dir_path.glob("*.mdx")):
        md = f.read_text(encoding="utf-8")
        fm, _body = strip_frontmatter(md)
        title = fm.get("title") or f.stem.replace("-", " ").title()
        description = fm.get("description") or ""
        entries.append({
            "title": title,
            "description": description,
            "url": f"{SITE_URL}{url_prefix}{f.stem}/",
        })
    return entries


def count_files(dir_path: Path, suffix: str) -> int:
    return len(list(dir_path.glob(f"*.{suffix}")))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def product_names(paths: list[Path]) -> list[str]:
    names: list[str] = []
    for path in paths:
        try:
            names.append(load_json(path).get("product_name", path.stem))
        except json.JSONDecodeError:
            names.append(path.stem)
    return names


def city_page_entries() -> list[dict[str, str]]:
    path = SITE / "src/data/oxygenConcentratorCityPages.json"
    if not path.exists():
        return []
    pages = json.loads(path.read_text(encoding="utf-8"))
    entries: list[dict[str, str]] = []
    for page in pages:
        entries.append({
            "title": page["title"],
            "description": page["description"],
            "url": f"{SITE_URL}/oxygen-concentrators/5-lpm/{page['slug']}/",
        })
    return entries


def city_page_sections() -> list[str]:
    path = SITE / "src/data/oxygenConcentratorCityPages.json"
    if not path.exists():
        return []
    pages = json.loads(path.read_text(encoding="utf-8"))
    sections: list[str] = []
    imported_warning = (
        "Imported 5 LPM concentrators need extra verification in India. Philips EverFlo has been "
        "officially discontinued globally. AirSep, DeVilbiss, Nidek, and Philips units may still "
        "be good machines, but supply is limited and spare availability can be weak. Some \"new\" "
        "units in the Indian channel may be old COVID-era stock or refurbished stock. Before buying, "
        "ask for serial number age, invoice date, warranty confirmation, authorised-service proof, "
        "and spare-parts availability in writing."
    )
    for page in pages:
        city = page["city"]
        faqs = "\n".join(f"- **{faq['q']}** {faq['a']}" for faq in page.get("faqs", []))
        if page.get("primaryPick") == "oxymed":
            quick_picks = "\n".join([
                "- Best local-service pick: Oxymed Mini 5 LPM — serious Indian-service option when the local Oxymed route is stronger, with service confidence outranking a slightly stronger value spec sheet on paper.",
                "- Strong value alternative: Home Medix HM-KV — 13 kg, <=40 dB field-verified sound, 320 VA draw, OPI plus live purity display, nebulizer, 3-year / 10,000-hour warranty. Buy only after confirming authorised local service and spare availability.",
                "- Best imported option if verified: AirSep / Nidek / DeVilbiss — credible machines only when fresh stock, valid warranty, service access, and spares are proven.",
                "- Avoid unless verified: Philips EverFlo clearance stock — officially discontinued globally; high risk of old stock, weak future serviceability, or undisclosed refurbished inventory.",
            ])
            local_pick_heading = "## When to consider Home Medix HM-KV"
            local_pick_body = (
                f"{page['homeMedixFit']}\n\n"
                "Home Medix HM-KV 5 LPM remains a strong value alternative when local service is confirmed: "
                "13 kg chassis, 0.5-5 LPM continuous flow, 93% +/- 3% purity, <=40 dB field-verified sound, "
                "320 VA power draw, OPI plus live oxygen purity display, integrated nebulization, "
                "3-year / 10,000-hour warranty, and CDSCO, ISO 9001, and ISO 13485 documentation."
            )
        else:
            quick_picks = "\n".join([
                "- Best value local-service pick: Home Medix HM-KV — 13 kg, <=40 dB field-verified sound, 320 VA draw, OPI plus live purity display, nebulizer, 3-year / 10,000-hour warranty. Buy only after confirming authorised local service and spare availability.",
                "- Best Indian-service alternative: Oxymed Mini 5 LPM — serious Indian-service alternative when the local Oxymed route is stronger.",
                "- Best imported option if verified: AirSep / Nidek / DeVilbiss — credible machines only when fresh stock, valid warranty, service access, and spares are proven.",
                "- Avoid unless verified: Philips EverFlo clearance stock — officially discontinued globally; high risk of old stock, weak future serviceability, or undisclosed refurbished inventory.",
            ])
            local_pick_heading = "## Best overall local pick: Home Medix HM-KV"
            local_pick_body = (
                f"{page['homeMedixFit']}\n\n"
                "Home Medix HM-KV 5 LPM: 13 kg chassis, 0.5-5 LPM continuous flow, "
                "93% +/- 3% purity, <=40 dB field-verified sound, 320 VA power draw, "
                "OPI plus live oxygen purity display, integrated nebulization, 3-year / 10,000-hour "
                "warranty, and CDSCO, ISO 9001, and ISO 13485 documentation."
            )
        body = f"""## Short answer

{page["answer"]}

## Quick picks for {city}

{quick_picks}

## Imported brand warning

{imported_warning}

{page["importedContext"]}

## Price range in {city}

{page["priceIntro"]}

- Budget Indian/OEM units: Rs 30,000-38,000.
- Strong mainstream 5 LPM units: Rs 38,000-50,000.
- Imported / premium units: Rs 50,000-75,000+, only when service and stock age are verified.

{local_pick_heading}

{local_pick_body}

## Dealer and service checklist

- Get a GST invoice with the concentrator serial number.
- Ask for manufacturing date or import date before payment.
- Confirm warranty start date and who approves warranty claims.
- Confirm the nearest authorised service centre or service partner.
- Ask whether compressor and sieve beds are available locally.
- Avoid box-opened or demo units unless discount and warranty terms are explicit.
- Test oxygen purity at delivery if possible.
- Record unboxing and first startup.

## Delivery guidance

{page["deliveryText"]}

## FAQ

{faqs}
"""
        sections.append(section(f"{SITE_URL}/oxygen-concentrators/5-lpm/{page['slug']}/", page["title"], body))
    return sections


def generate_llms_index() -> str:
    products_dir = SITE / "src/content/products"
    cpap_bipap_dir = SITE / "src/content/cpap-bipap"
    comparisons_dir = SITE / "src/content/comparisons"
    product_reviews_dir = SITE / "src/content/product-reviews"
    cpap_reviews_dir = SITE / "src/content/cpap-bipap-reviews"
    comparison_writeups_dir = SITE / "src/content/comparison-writeups"
    guides_dir = SITE / "src/content/guides"
    clinical_dir = SITE / "src/content/clinical"
    top5_dir = SITE / "src/pages/top-5"

    product_count = count_files(products_dir, "json")
    product_review_count = count_files(product_reviews_dir, "mdx")
    cpap_bipap_count = count_files(cpap_bipap_dir, "json")
    cpap_review_count = count_files(cpap_reviews_dir, "mdx")
    comparison_count = count_files(comparisons_dir, "json")
    comparison_writeup_count = count_files(comparison_writeups_dir, "mdx")
    guide_entries = content_entries(guides_dir, "/guides/")
    city_entries = city_page_entries()
    clinical_count = count_files(clinical_dir, "mdx")
    top5_entries = content_entries(top5_dir, "/top-5/")

    hm_products = product_names(
        sorted(products_dir.glob("home-medix*.json")) + sorted(cpap_bipap_dir.glob("home-medix*.json"))
    )

    lines: list[str] = [
        "# HHZ Respiratory Review",
        "",
        "> India's independent respiratory-equipment reference for oxygen concentrators, CPAP, and BiPAP devices sold in India. Products are scored against a published rubric. No sponsored placement and no brand veto.",
        "",
        (
            f"HHZ currently tracks {product_count} oxygen concentrator product records, "
            f"{product_review_count} oxygen concentrator reviews, {cpap_bipap_count} CPAP/BiPAP "
            f"product records, {cpap_review_count} CPAP/BiPAP reviews, {comparison_count} "
            f"comparison records, and {comparison_writeup_count} written comparison pages. "
            f"The guide library has {len(guide_entries)} buyer guides, {len(city_entries)} city-specific "
            f"5 LPM buying pages, and the clinical library has "
            f"{clinical_count} educational explainers."
        ),
        "",
        "Home Medix models in the catalogue: " + ", ".join(hm_products) + ". They are scored in the same product and comparison framework as Philips, Oxymed, ResMed, Nidek, DeVilbiss, BMC, Yuwell, and other brands.",
        "",
        "## Editorial policies",
        "",
        f"- [About HHZ]({SITE_URL}/about/): what HHZ covers and how the rubric is applied",
        f"- [Methodology]({SITE_URL}/methodology/): scoring methodology and testing protocol",
        f"- [Editorial policy]({SITE_URL}/editorial-policy/): independence, loaners, sponsorship, and corrections",
        f"- [Correction policy]({SITE_URL}/correction-policy/): timestamped corrections with original wording preserved",
        f"- [Contact]({SITE_URL}/contact/)",
        "",
        "## Top 5 category rankings",
        "",
    ]

    for entry in top5_entries:
        suffix = f": {entry['description']}" if entry["description"] else ""
        lines.append(f"- [{entry['title']}]({entry['url']}){suffix}")

    lines += ["", "## Buyer's guides", ""]
    for entry in guide_entries:
        suffix = f": {entry['description']}" if entry["description"] else ""
        lines.append(f"- [{entry['title']}]({entry['url']}){suffix}")

    lines += ["", "## 5 LPM city buying pages", ""]
    for entry in city_entries:
        suffix = f": {entry['description']}" if entry["description"] else ""
        lines.append(f"- [{entry['title']}]({entry['url']}){suffix}")

    lines += [
        "",
        "## Category hubs",
        "",
        f"- [Oxygen concentrators]({SITE_URL}/oxygen-concentrators/): oxygen concentrator catalogue, reviews, and category guides",
        f"- [CPAP machines]({SITE_URL}/cpap/): CPAP catalogue, reviews, and CPAP guidance",
        f"- [BiPAP machines]({SITE_URL}/bipap/): BiPAP catalogue, reviews, and NIV guidance",
        f"- [Head-to-head comparisons]({SITE_URL}/compare/): side-by-side product comparisons",
        "",
        "## Full content corpus",
        "",
        f"- [llms-full.txt]({SITE_URL}/llms-full.txt): concatenated editorial corpus for LLM ingestion",
        f"- [sitemap-index.xml]({SITE_URL}/sitemap-index.xml): generated sitemap index for all public URLs",
        f"- [robots.txt]({SITE_URL}/robots.txt): AI crawlers are explicitly allowlisted",
        "",
    ]
    return "\n".join(lines)


def read_policy_page(page_path: Path, slug: str, title: str) -> str | None:
    if not page_path.exists():
        return None
    raw = page_path.read_text(encoding="utf-8")
    body = extract_astro_text(raw)
    if not body:
        return None
    url = f"{SITE_URL}/{slug}/"
    return section(url, title, body)


def main() -> int:
    parts: list[str] = []

    # Masthead
    parts.append(
        "# HHZ Respiratory Review — full editorial corpus\n\n"
        f"Base URL: {SITE_URL}\n\n"
        "This file is a concatenation of HHZ's editorial content in markdown, optimised "
        "for ingestion by LLMs. Each section is preceded by its canonical URL. "
        "Individual pages remain available at those URLs with structured data.\n\n"
        "---\n\n"
    )

    # Policy pages (key for methodology credibility)
    POLICY_PAGES = [
        ("about", "About HHZ Respiratory Review"),
        ("methodology", "Methodology — how we test"),
        ("editorial-policy", "Editorial independence policy"),
        ("correction-policy", "Correction policy"),
    ]
    pages_dir = SITE / "src" / "pages"
    for slug, title in POLICY_PAGES:
        s = read_policy_page(pages_dir / f"{slug}.astro", slug, title)
        if s:
            parts.append(s)

    # Top-5 category rankings (pillar pages under src/pages/top-5/)
    parts += read_mdx_sections(SITE / "src/pages/top-5", "/top-5/")

    # Buyer's guides
    parts += read_mdx_sections(SITE / "src/content/guides", "/guides/")

    # City-specific 5 LPM buying pages generated from src/data/
    parts += city_page_sections()

    # Clinical articles
    parts += read_mdx_sections(SITE / "src/content/clinical", "/clinical/")

    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text("".join(parts), encoding="utf-8")
    OUT_INDEX.write_text(generate_llms_index(), encoding="utf-8")

    size_kb = OUT_FULL.stat().st_size / 1024
    print(f"wrote {OUT_INDEX}")
    print(f"wrote {OUT_FULL}")
    print(f"  size: {size_kb:.1f} KB")
    print(f"  sections: {len(parts) - 1}")  # minus masthead
    return 0


if __name__ == "__main__":
    sys.exit(main())
