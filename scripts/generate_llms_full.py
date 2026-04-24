#!/usr/bin/env python3
"""Concatenate HHZ editorial content into public/llms-full.txt for LLM ingestion.

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
from pathlib import Path

SITE = Path.home() / "hhz-site"
OUT = SITE / "public" / "llms-full.txt"

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

    # Clinical articles
    parts += read_mdx_sections(SITE / "src/content/clinical", "/clinical/")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")

    size_kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT}")
    print(f"  size: {size_kb:.1f} KB")
    print(f"  sections: {len(parts) - 1}")  # minus masthead
    return 0


if __name__ == "__main__":
    sys.exit(main())
