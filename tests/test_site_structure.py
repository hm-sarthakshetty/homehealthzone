"""Regression fixtures for the built-site crawler (no Astro build required)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'site_structure', Path(__file__).resolve().parents[1] / 'scripts/validate_site_structure.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class StructureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dist = Path(self.temp.name)
        self.urls = set()

    def page(self, route, body='', *, redirect=None, noindex=False):
        path = self.dist / route.lstrip('/') / 'index.html'
        path.parent.mkdir(parents=True, exist_ok=True)
        head = f'<link rel="canonical" href="{validator.ORIGIN}{route}">'
        if redirect is not None:
            head += f'<meta http-equiv="refresh" content="0;url={redirect}">'
        elif not noindex:
            self.urls.add(validator.ORIGIN + route)
        if noindex:
            head += '<meta name="robots" content="noindex, nofollow">'
        path.write_text(head + '<h1>Fixture</h1>' + body)

    def audit(self):
        return validator.audit_structure(self.dist, self.urls)[1]

    def test_relative_links_assets_and_encoded_fragments(self):
        self.page('/', '<a href="section/">Section</a>')
        self.page('/section/', '<a href="../target/?q=test#caf%C3%A9">Target</a><a href="../file.svg">File</a>')
        self.page('/target/', '<h2 id="café">Target</h2>')
        (self.dist / 'file.svg').write_text('<svg/>')
        self.assertEqual(self.audit(), [])

    def test_sitemap_and_noscript_do_not_rescue_orphan(self):
        self.page('/', '<a href="/search/">Search</a>')
        self.page('/search/', '<noscript><a href="/orphan/">Orphan</a></noscript>', noindex=True)
        self.page('/orphan/')
        self.assertEqual(self.audit(), ['Unreachable from homepage via HTML navigation: /orphan/'])

    def test_redirect_follows_chain_and_inherits_fragment(self):
        self.page('/', '<a href="/old/#section">Old</a>')
        self.page('/old/', redirect='/middle/')
        self.page('/middle/', redirect='/target/')
        self.page('/target/', '<h2 id="section">Target</h2>')
        self.assertEqual(self.audit(), [])
        self.page('/target/')
        self.assertTrue(any('Broken anchor: / -> /old/#section' in error for error in self.audit()))

    def test_redirect_cycle_and_missing_destination(self):
        self.page('/', '<a href="/a/">A</a>')
        self.page('/a/', redirect='/b/')
        self.page('/b/', redirect='/a/')
        self.assertTrue(any('Redirect cycle:' in error for error in self.audit()))
        self.page('/b/', redirect='/missing/')
        self.assertTrue(any('Broken link: /b/ -> /missing/' in error for error in self.audit()))

    def test_all_pages_metadata_and_sitemap_membership(self):
        self.page('/', '<a href="/nested/">Nested</a>')
        self.page('/nested/')
        (self.dist / 'nested/index.html').write_text('<h1>One</h1><h1>Two</h1>')
        self.urls.remove(validator.ORIGIN + '/nested/')
        self.urls.add(validator.ORIGIN + '/missing/')
        errors = self.audit()
        self.assertTrue(any('Canonical mismatch: /nested/' in error for error in errors))
        self.assertTrue(any('Expected one h1: /nested/' in error for error in errors))
        self.assertTrue(any('Indexable page missing from sitemap: /nested/' in error for error in errors))
        self.assertTrue(any('Sitemap URL is not an indexable canonical page:' in error for error in errors))


if __name__ == '__main__':
    unittest.main()
