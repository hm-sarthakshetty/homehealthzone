#!/usr/bin/env python3
"""Verify the two Oxygenate landing pages in the built publication artifact."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
ORIGIN = 'https://homehealthzone.com'
PRODUCT = '/oxygen-concentrators/philips-oxygenate-5/'
ARTICLE = '/guides/philips-oxygenate-5-konsung-ksw-5/'


class Page(HTMLParser):
    def __init__(self, route):
        super().__init__()
        self.html = (DIST / route.strip('/') / 'index.html').read_text()
        self.meta, self.links, self.ids, self.images, self.schemas = {}, [], set(), [], []
        self.title, self.h1_count, self.canonical = '', 0, []
        self.in_title, self.in_schema, self.schema_text = False, False, ''
        self.feed(self.html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'meta':
            self.meta[a.get('property', a.get('name'))] = a.get('content', '')
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical.append(a.get('href'))
        if tag == 'a':
            self.links.append(a.get('href', ''))
        if tag == 'img':
            self.images.append(a)
        if tag == 'h1':
            self.h1_count += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.in_schema, self.schema_text = True, ''

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_schema:
            self.schema_text += data

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag == 'script' and self.in_schema:
            self.schemas.append(json.loads(self.schema_text))
            self.in_schema = False


pages = {route: Page(route) for route in [PRODUCT, ARTICLE]}
for route, page in pages.items():
    assert page.h1_count == 1, route
    assert page.canonical == [ORIGIN + route], route
    assert 'Philips Oxygenate 5' in page.title and len(page.title) <= 65, page.title
    assert 100 <= len(page.meta['description']) <= 160, route
    assert 'noindex' not in page.meta.get('robots', ''), route
    assert 'max-image-preview:large' in page.meta.get('robots', ''), route
    image = page.meta['og:image']
    assert image.startswith(ORIGIN + '/images/social/'), image
    assert (DIST / urlparse(image).path.lstrip('/')).is_file(), image
    assert page.meta['twitter:image'] == image
    assert page.meta['twitter:card'] == 'summary_large_image'
    assert page.meta['og:image:width'] == '1200' and page.meta['og:image:height'] == '630'
    assert page.meta['og:image:alt'] and page.meta['twitter:image:alt']
    for img in page.images:
        assert img.get('alt'), (route, img)
        if img.get('src', '').startswith('/'):
            assert (DIST / img['src'].lstrip('/')).is_file(), img['src']
    for href in page.links:
        target = urlparse(href)
        if not target.path and target.fragment:
            assert unquote(target.fragment) in page.ids, href

product = pages[PRODUCT]
article = pages[ARTICLE]
assert 'Price in India' in product.title
assert 'Konsung KSW-5' in article.title
assert '₹45,000–₹55,000' in product.meta['description']
assert ARTICLE in product.links and PRODUCT in article.links
schema = next(s for s in product.schemas if s.get('@type') == 'Product')
assert schema['brand']['name'] == 'Philips'
assert schema['manufacturer']['name'].startswith('Jiangsu Konsung')
assert schema['countryOfOrigin']['name'] == 'China'
assert schema['mpn'] == schema['model'] == 'KSW-5' and schema['sku'] == '1156380'
assert schema['offers']['lowPrice'] == '45000' and schema['offers']['highPrice'] == '55000'
assert 'aggregateRating' not in schema and 'reviewRating' not in schema.get('review', {})
a = next(s for s in article.schemas if s.get('@type') == 'Article')
assert a['image'] == [article.meta['og:image']]
assert any(item['@id'] == schema['@id'] for item in a['about'])
assert a['citation'] and all(url.startswith('https://') for url in a['citation'])
assert article.meta['og:type'] == 'article' and article.meta['article:published_time'] == a['datePublished']
assert 'aria-label="On this page"' in article.html
index = json.loads((DIST / 'search-index.json').read_text())
assert all(any(item['h'] == route for item in index) for route in pages)
for route in ['/oxygen-concentrators/brands/', '/oxygen-concentrators/5-lpm/', '/guides/philips-everflo-replacement-india/']:
    source = Page(route)
    assert ARTICLE in source.links and PRODUCT in source.links, route
print('Verified Oxygenate SEO: titles, descriptions, share images, schema entities, price range, citations, TOC, search and contextual links.')
