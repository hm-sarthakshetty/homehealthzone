#!/usr/bin/env python3
"""Check the built navigation, search coverage and sitemap before deployment."""
import json
import re
from collections import deque
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
ORIGIN = "https://homehealthzone.com"


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.links = []
        self.navigation_links = []
        self.noscript_depth = 0
        self.redirect = None
        self.canonical = []
        self.inputs = []
        self.labels = []
        self.h1_count = 0
        self.robots = ""
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "noscript":
            self.noscript_depth += 1
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a":
            if "href" in attrs:
                self.links.append(attrs["href"])
                if not self.noscript_depth:
                    self.navigation_links.append(attrs["href"])
            if attrs.get("name"):
                self.ids.add(attrs["name"])
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        if tag == "input" and attrs.get("role") == "combobox":
            self.inputs.append(attrs)
        if tag == "label":
            self.labels.append(attrs.get("for"))
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots += " " + attrs.get("content", "").lower()
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            content = attrs.get("content", "")
            match = re.search(r";\s*url\s*=\s*(.*)$", content, re.I)
            self.redirect = match.group(1).strip().strip("\"' ") if match else ""

    def handle_endtag(self, tag):
        if tag == "noscript":
            self.noscript_depth = max(0, self.noscript_depth - 1)


def page_path(url):
    path = unquote(urlparse(url).path)
    return DIST / path.lstrip("/") / "index.html"


def audit_structure(dist, sitemap_urls):
    """Crawl actual HTML links, never treating XML or noscript as navigation."""
    pages = {}
    files = {}
    for path in sorted(dist.rglob("*.html")):
        relative = "/" + path.relative_to(dist).as_posix()
        route = relative[:-10] if relative.endswith("/index.html") else relative
        pages[route] = Page(path)
        files[relative] = route
    errors = []
    edges = {route: set() for route in pages}
    origin = urlparse(ORIGIN)

    def resolve(source, href):
        url = urlparse(urljoin(ORIGIN + source, href))
        if url.scheme not in ("http", "https") or url.netloc != origin.netloc:
            return None, url
        path = unquote(url.path)
        route = path if path in pages else files.get(path)
        if route is None and path + "/" in pages:
            route = path + "/"
        if route is not None:
            return route, url
        asset = (dist / path.lstrip("/")).resolve()
        if not asset.is_relative_to(dist.resolve()) or not asset.is_file():
            errors.append(f"Broken link: {source} -> {href}")
        return None, url

    def destination(source, href):
        route, url = resolve(source, href)
        fragment = url.fragment
        visited = set()
        while route is not None and pages[route].redirect is not None:
            if route in visited:
                errors.append(f"Redirect cycle: {source} -> {href}")
                return None
            visited.add(route)
            redirect = pages[route].redirect
            if not redirect:
                errors.append(f"Missing redirect target: {route}")
                return None
            route, target = resolve(route, redirect)
            # Redirects inherit the incoming fragment unless they specify one.
            if "#" in redirect:
                fragment = target.fragment
        # Text-fragment directives do not require a matching element ID.
        anchor = unquote(fragment.split(":~:text=", 1)[0])
        if route is not None and anchor and anchor not in pages[route].ids:
            errors.append(f"Broken anchor: {source} -> {href} (resolved to {route})")
        return route

    indexable = {route for route, page in pages.items()
                 if page.redirect is None and "noindex" not in page.robots
                 and route not in ("/404.html", "/404/")}
    for route, page in pages.items():
        if route in indexable:
            if page.h1_count != 1:
                errors.append(f"Expected one h1: {route} (found {page.h1_count})")
            if page.canonical != [ORIGIN + route]:
                errors.append(f"Canonical mismatch: {route}: {page.canonical}")
            if ORIGIN + route not in sitemap_urls:
                errors.append(f"Indexable page missing from sitemap: {route}")
        for field in page.inputs:
            if not field.get("id") or field.get("id") not in page.labels:
                errors.append(f"Unlabelled search: {route}")
            if not field.get("aria-controls") or field.get("aria-controls") not in page.ids:
                errors.append(f"Missing search list: {route}")
        navigation_links = set(page.navigation_links)
        for href in page.links:
            target = destination(route, href)
            if target is not None and href in navigation_links:
                edges[route].add(target)
        if page.redirect is not None:
            target = destination(route, ORIGIN + route)
            if target is not None:
                edges[route].add(target)
    for url in sorted(sitemap_urls):
        parsed = urlparse(url)
        if (parsed.scheme + "://" + parsed.netloc != ORIGIN
                or parsed.query or parsed.fragment or parsed.path not in indexable):
            errors.append(f"Sitemap URL is not an indexable canonical page: {url}")
    reached = {"/"} if "/" in pages else set()
    queue = deque(reached)
    while queue:
        for target in edges[queue.popleft()] - reached:
            reached.add(target)
            queue.append(target)
    for route in sorted(indexable - reached):
        errors.append(f"Unreachable from homepage via HTML navigation: {route}")
    return pages, sorted(set(errors))


def main():

    index = json.loads((DIST / "search-index.json").read_text())
    clinical_count = len(list((ROOT / "src/content/clinical").glob("*.mdx")))
    guide_count = len(list((ROOT / "src/content/guides").glob("*.mdx")))
    assert sum(item["t"] == "c" for item in index) == clinical_count
    assert sum(item["m"] == "in" and item["t"] == "g" for item in index) == guide_count
    assert all(item["m"] == "in" for item in index if item["t"] in {"d", "v", "s", "l", "h"})
    assert len({item["h"] for item in index}) == len(index), "Duplicate search results"
    assert all(page_path(item["h"]).exists() for item in index), "Search result has no page"
    assert all(not item.get("p") for item in index if item.get("s")), "Discontinued price"

    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    sitemap = ET.Element("sitemaps")
    for sitemap_path in sorted(DIST.glob("sitemap*.xml")):
        sitemap.extend(ET.parse(sitemap_path).getroot().findall("s:url", ns))
    assert len(sitemap), "No sitemap URLs found"
    urls = set()
    for entry in sitemap.findall("s:url", ns):
        url = entry.findtext("s:loc", namespaces=ns)
        assert url not in urls, f"Duplicate sitemap URL: {url}"
        urls.add(url)
        languages = [link.get("hreflang") for link in entry.findall("x:link", ns)]
        assert len(languages) == len(set(languages)), f"Duplicate hreflang: {url}"
    pages, structure_errors = audit_structure(DIST, urls)
    assert not structure_errors, "Site structure errors:\n" + "\n".join(structure_errors)
    assert ORIGIN + "/site-map/" in urls
    assert ORIGIN + "/search/" not in urls
    assert all(ORIGIN + item["h"] in urls for item in index)
    comparison_routes = {f"/compare/{json.loads(path.read_text())['slug']}/"
                         for path in (ROOT / "src/content/comparisons").glob("*.json")}
    assert {item["h"] for item in index if item["t"] == "v"} == comparison_routes, "Comparison search coverage mismatch"
    shortlist_routes = {route for route in pages if route.startswith("/top-5/") and route != "/top-5/"}
    assert {item["h"] for item in index if item["t"] == "s"} == shortlist_routes, "Shortlist search coverage mismatch"


    partners = json.loads((ROOT / 'src/data/respiratory-partners.json').read_text())
    assert len(partners) == 10, 'Expected the ten confirmed Home Medix partners'
    assert len({partner['slug'] for partner in partners}) == len(partners), 'Duplicate partner identity'
    partner_routes = [f"/in/respiratory-care-experts/{partner['region']}/{partner['slug']}/" for partner in partners]
    region_routes = [f'/in/respiratory-care-experts/{region}/' for region in dict.fromkeys(partner['region'] for partner in partners)]
    for route in ["/", "/search/", "/site-map/", *region_routes, *partner_routes]:
        assert route in pages, f"Missing required page: {route}"
    assert "noindex" in pages["/search/"].robots
    assert pages["/search/"].canonical == [ORIGIN + "/search/"]

    partner_feed = json.loads((DIST / 'datasets/respiratory-partners.json').read_text())
    assert partner_feed['record_count'] == 10
    assert {row['canonical_url'] for row in partner_feed['records']} == {ORIGIN + route for route in partner_routes}
    assert all('identityConfidence' not in row for row in partner_feed['records']), 'Private research status leaked'
    for row in partner_feed['records']:
        assert len(row['services']) == 5 and all(service['brand'] == 'Home Medix' for service in row['services'])
    for partner, route in zip(partners, partner_routes):
        assert partner['name'] in page_path(route).read_text(), f"Missing partner: {partner['name']}"
        assert ORIGIN + route in urls, f'Partner missing from sitemap: {route}'
    corpus = (DIST / 'llms/partners-manufacturers.txt').read_text()
    assert all(partner['name'] in corpus for partner in partners), 'Partner missing from text reference'

    updates = json.loads((ROOT / "src/data/page-updates.json").read_text())
    dates = {entry.findtext("s:loc", namespaces=ns): entry.findtext("s:lastmod", namespaces=ns)
             for entry in sitemap.findall("s:url", ns)}
    for route, date in updates.items():
        assert (dates.get(ORIGIN + route) or "").startswith(date), f"Missing explicit edit date: {route}"

    print(f"Validated {len(index)} search results, including {clinical_count} clinical articles and {guide_count} India guides.")
    print(f"Validated {len(urls)} sitemap URLs and links, anchors, labels and canonicals on all {len(pages)} built HTML pages, including homepage reachability.")


if __name__ == "__main__":
    main()
