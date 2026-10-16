#!/usr/bin/env python3
"""Check the built navigation, search coverage and sitemap before deployment."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
ORIGIN = "https://homehealthzone.com"


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.links = []
        self.canonical = []
        self.inputs = []
        self.labels = []
        self.h1_count = 0
        self.robots = ""
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        if tag == "input" and attrs.get("role") == "combobox":
            self.inputs.append(attrs)
        if tag == "label":
            self.labels.append(attrs.get("for"))
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta" and attrs.get("name") == "robots":
            self.robots = attrs.get("content", "")


def page_path(url):
    path = unquote(urlparse(url).path)
    return DIST / path.lstrip("/") / "index.html"


index = json.loads((DIST / "search-index.json").read_text())
clinical_count = len(list((ROOT / "src/content/clinical").glob("*.mdx")))
guide_count = len(list((ROOT / "src/content/guides").glob("*.mdx")))
assert sum(item["t"] == "c" for item in index) == clinical_count
assert sum(item["m"] == "in" and item["t"] == "g" for item in index) == guide_count
assert all(item["m"] == "in" for item in index if item["t"] == "d")
assert len({item["h"] for item in index}) == len(index), "Duplicate search results"
assert all(page_path(item["h"]).exists() for item in index), "Search result has no page"
assert all(not item.get("p") for item in index if item.get("s")), "Discontinued price"

ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
sitemap = ET.parse(DIST / "sitemap-0.xml").getroot()
urls = set()
for entry in sitemap.findall("s:url", ns):
    url = entry.findtext("s:loc", namespaces=ns)
    assert url not in urls, f"Duplicate sitemap URL: {url}"
    urls.add(url)
    languages = [link.get("hreflang") for link in entry.findall("x:link", ns)]
    assert len(languages) == len(set(languages)), f"Duplicate hreflang: {url}"
assert ORIGIN + "/site-map/" in urls
assert ORIGIN + "/search/" not in urls
assert all(ORIGIN + item["h"] in urls for item in index)

routes = ["/", "/in/", "/us/", "/uk/", "/sg/", "/au/", "/ca/", "/nz/", "/site-map/", "/search/"]
for route in routes:
    page = Page(page_path(route))
    assert page.h1_count == 1, f"Expected one h1: {route}"
    assert page.canonical == [ORIGIN + route], f"Canonical mismatch: {route}"
    for field in page.inputs:
        assert field["id"] in page.labels, f"Unlabelled search: {route}"
        assert field["aria-controls"] in page.ids, f"Missing search list: {route}"
    for href in page.links:
        target = urlparse(href)
        if target.netloc and target.netloc != "homehealthzone.com":
            continue
        if target.scheme and target.scheme not in ("http", "https"):
            continue
        target_path = target.path or route
        assert page_path(target_path).exists(), f"Broken link: {route} -> {href}"
        if target.fragment:
            assert unquote(target.fragment) in Page(page_path(target_path)).ids, f"Broken anchor: {route} -> {href}"
    if route == "/search/":
        assert "noindex" in page.robots

updates = json.loads((ROOT / "src/data/page-updates.json").read_text())
dates = {entry.findtext("s:loc", namespaces=ns): entry.findtext("s:lastmod", namespaces=ns)
         for entry in sitemap.findall("s:url", ns)}
for route, date in updates.items():
    assert dates[ORIGIN + route].startswith(date), f"Missing explicit edit date: {route}"

print(f"Validated {len(index)} search results, including {clinical_count} clinical articles and {guide_count} India guides.")
print(f"Validated {len(urls)} sitemap URLs and links, anchors, labels and canonicals on {len(routes)} navigation pages.")
