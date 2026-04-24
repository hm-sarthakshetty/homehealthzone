#!/usr/bin/env python3
"""Convert scraped oxygentimes specs into Astro content collection JSON files.

Sources (read):
  ~/hhz-scrape/oxygentimes-mirror/specs/products.json
  ~/hhz-scrape/oxygentimes-mirror/specs/cpap-bipap.json
  ~/hhz-scrape/oxygentimes-mirror/extracted/comparison-matchups.csv
  ~/hhz-scrape/oxygentimes-mirror/extracted/most-compared-products.csv

Destinations (write):
  ~/hhz-site/src/content/products/<slug>.json
  ~/hhz-site/src/content/cpap-bipap/<slug>.json
  ~/hhz-site/src/content/comparisons/<slug>.json
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

SRC_ROOT = Path.home() / "hhz-scrape" / "oxygentimes-mirror"
SITE_ROOT = Path.home() / "hhz-site"

DEST_PRODUCTS = SITE_ROOT / "src" / "content" / "products"
DEST_CPAP = SITE_ROOT / "src" / "content" / "cpap-bipap"
DEST_COMPARISONS = SITE_ROOT / "src" / "content" / "comparisons"


def url_slug(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return (path.rsplit("/", 1)[-1] if path else "").lower()


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-") or "untitled"


def safe_image_name(img_url: str, product_name: str) -> str:
    """Reproduce download_images.py's safe_name() logic."""
    parsed = urlparse(img_url)
    ext = Path(parsed.path).suffix.lower() or ".jpg"
    h = hashlib.sha1(img_url.encode()).hexdigest()[:10]
    pn = re.sub(r"[^a-z0-9]+", "-", (product_name or "product").lower()).strip("-") or "product"
    return f"{pn}-{h}{ext}"


def image_is_downloaded(img_url: str, product_name: str) -> bool:
    filename = safe_image_name(img_url, product_name)
    return (SITE_ROOT / "public" / "images" / "products" / filename).exists()


def detect_device_type(category: str | None, name: str | None) -> str:
    cat = (category or "").lower()
    nm = (name or "").lower()
    if any(token in cat or token in nm for token in ("bipap", "bi-level", "bi level", "avaps", "vpap", "st bipap", "auto bipap")):
        return "bipap"
    return "cpap"


def process_product(p: dict, emit_device_type: bool = False) -> dict | None:
    name = (p.get("product_name") or "").strip()
    url = p.get("url") or ""
    slug = url_slug(url)
    if not name or not slug:
        return None

    images = []
    for img in (p.get("images") or []):
        src = img.get("src", "")
        if not src:
            continue
        if image_is_downloaded(src, name):
            images.append({
                "src": f"/images/products/{safe_image_name(src, name)}",
                "alt": img.get("alt") or name,
                "original": src,
            })
        else:
            images.append({
                "src": src,
                "alt": img.get("alt") or name,
                "original": src,
            })

    # Scrub whitespace from rating_value (parser cosmetic bug)
    rv = p.get("rating_value")
    if isinstance(rv, str):
        rv = re.sub(r"\s+", " ", rv).strip() or None

    out = {
        "slug": slug,
        "source_url": url,
        "product_name": name,
        "brand": p.get("brand") or "",
        "brand_href": p.get("brand_href"),
        "category": p.get("category") or "",
        "price_current": p.get("price_current"),
        "price_mrp": p.get("price_mrp"),
        "price_symbol": p.get("price_symbol") or "₹",
        "rating_value": rv,
        "rating_count": p.get("rating_count"),
        "stock": p.get("stock") or "",
        "images": images,
        "key_features": p.get("key_features") or {},
        "spec_tables": {
            label: rows for label, rows in (p.get("spec_tables") or {}).items() if rows
        },
        "faqs": p.get("faqs") or [],
        "description_text": p.get("description_text") or "",
        "related_links": p.get("related_links") or [],
    }
    if emit_device_type:
        out["device_type"] = detect_device_type(p.get("category"), name)
    return out


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def write_products() -> int:
    reset_dir(DEST_PRODUCTS)
    products = json.loads((SRC_ROOT / "specs" / "products.json").read_text())
    n = 0
    for p in products:
        record = process_product(p)
        if not record:
            continue
        (DEST_PRODUCTS / f"{record['slug']}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        n += 1
    return n


def write_cpap_bipap() -> int:
    reset_dir(DEST_CPAP)
    cpap = json.loads((SRC_ROOT / "specs" / "cpap-bipap.json").read_text())
    n = 0
    for p in cpap:
        record = process_product(p, emit_device_type=True)
        if not record:
            continue
        (DEST_CPAP / f"{record['slug']}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        n += 1
    return n


def write_comparisons(top_n: int = 50) -> int:
    reset_dir(DEST_COMPARISONS)

    counts: dict[str, int] = {}
    counts_path = SRC_ROOT / "extracted" / "most-compared-products.csv"
    if counts_path.exists():
        with counts_path.open() as f:
            next(f, None)
            for row in csv.reader(f):
                if len(row) >= 2:
                    try:
                        counts[row[0].lower()] = int(row[1])
                    except ValueError:
                        pass

    matchups_path = SRC_ROOT / "extracted" / "comparison-matchups.csv"
    if not matchups_path.exists():
        return 0

    matchups: list[tuple[str, str, str]] = []
    with matchups_path.open() as f:
        next(f, None)
        for row in csv.reader(f):
            if len(row) < 3:
                continue
            a, b, url = row[0], row[1], row[2]
            if a.lower() == b.lower():
                continue
            matchups.append((a, b, url))

    seen: set[tuple[str, str]] = set()
    canonical: list[tuple[str, str, str]] = []
    for a, b, url in matchups:
        key = tuple(sorted((a.lower(), b.lower())))
        if key in seen:
            continue
        seen.add(key)
        canonical.append((a, b, url))

    def rank(t: tuple[str, str, str]) -> int:
        return counts.get(t[0].lower(), 0) + counts.get(t[1].lower(), 0)

    canonical.sort(key=rank, reverse=True)

    n = 0
    for a, b, url in canonical[:top_n]:
        slug_a = slugify(a)
        slug_b = slugify(b)
        slug = f"{slug_a}-vs-{slug_b}"
        record = {
            "slug": slug,
            "source_url": url,
            "productA_slug": slug_a,
            "productA_name": a,
            "productB_slug": slug_b,
            "productB_name": b,
            "comparison_score": rank((a, b, url)),
            "title": f"{a} vs {b}",
        }
        (DEST_COMPARISONS / f"{slug}.json").write_text(
            json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        n += 1
    return n


def main() -> int:
    p = write_products()
    c = write_cpap_bipap()
    cmp = write_comparisons()
    print(f"wrote {p} products → {DEST_PRODUCTS}")
    print(f"wrote {c} cpap-bipap → {DEST_CPAP}")
    print(f"wrote {cmp} comparisons → {DEST_COMPARISONS}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
