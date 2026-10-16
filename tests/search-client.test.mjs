import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeSearchBox } from '../src/lib/search-client.mjs';

// Minimal DOM fixture exercises the production controller without a browser dependency.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {};
    this.listeners = {}; this.hidden = false; this.value = ''; this.textContent = '';
    this.classList = { toggle: (name, on) => { this.activeClass = on; } };
  }
  querySelector(selector) { return this.queries?.[selector]; }
  append(...children) { for (const child of children) { this.children.push(child); child.parent = this; } }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  fire(name, extras = {}) {
    const event = { target: this, preventDefault() { this.prevented = true; }, ...extras };
    for (const callback of this.listeners[name] || []) callback(event);
    return event;
  }
  focus() { globalThis.document.activeElement = this; this.fire('focus'); }
  contains(target) { while (target) { if (target === this) return true; target = target.parent; } return false; }
  scrollIntoView() {}
  dispatchEvent(event) { this.lastEvent = event; }
}
function fixture({ remote = false, select = false, full = false, search = '' } = {}) {
  const box = new Element();
  const input = new Element('input'), list = new Element('ul'), status = new Element('p'), retry = new Element('button');
  const allLink = new Element('a'), data = new Element('script');
  const market = new Element('select'), type = new Element('select');
  data.textContent = JSON.stringify([
    { name: 'ResMed AirSense 11', brand: 'ResMed', slug: 'airsense-11', market: 'in', type: 'd', href: '/cpap/airsense-11/' },
    { name: 'AirSense guide', market: 'us', type: 'g', href: '/us/guides/airsense/' },
  ]);
  box.dataset = { searchId: 'test-search', minChars: '2', maxResults: '8', target: select ? 'select' : 'navigate', market: 'all', fullResults: String(full), ...(remote ? { src: '/controller-index.json' } : {}) };
  box.queries = { input, '[role="listbox"]': list, '[role="status"]': status, '.searchbox__retry': retry, '.searchbox__all': allLink,
    '.searchbox__data': data, '.searchbox__market': market, '.searchbox__type': type };
  box.append(input, list, status, retry, allLink, market, type);
  globalThis.document = { activeElement: input, createElement: (tag) => new Element(tag), addEventListener() {} };
  const navigations = [];
  globalThis.window = { location: { search, assign: (href) => navigations.push(href) }, history: { replaceState: (_, __, href) => { box.currentUrl = href; } } };
  initializeSearchBox(box);
  return { box, input, list, status, retry, allLink, navigations, market, type };
}
const query = (input, text = 'airsense') => { input.value = text; input.fire('input'); };

test('arrow navigation sets active descendant and exactly one selected option; Escape keeps focus', () => {
  const { input, list, box } = fixture();
  query(input);
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(list.children.length, 2);
  assert.equal(input.getAttribute('aria-activedescendant'), null);
  input.fire('keydown', { key: 'ArrowUp' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'test-search-option-1');
  assert.equal(list.children[1].getAttribute('aria-selected'), 'true');
  input.fire('keydown', { key: 'ArrowDown' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'test-search-option-0');
  assert.equal(list.children.filter(x => x.getAttribute('aria-selected') === 'true').length, 1);
  input.fire('keydown', { key: 'End' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'test-search-option-1');
  input.fire('keydown', { key: 'Escape' });
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.getAttribute('aria-activedescendant'), null);
  assert.equal(globalThis.document.activeElement, input);
  assert.equal(box.dataset.searchInit, '1');
});
test('Enter uses selected result, otherwise opens complete query; Tab clears selection', () => {
  const { input, list, navigations } = fixture();
  query(input);
  input.fire('keydown', { key: 'Enter' });
  assert.equal(navigations.pop(), '/search/?q=airsense');
  input.fire('keydown', { key: 'ArrowDown' });
  input.fire('keydown', { key: 'Enter' });
  assert.equal(navigations.pop(), '/us/guides/airsense/');
  input.fire('keydown', { key: 'Tab' });
  assert.equal(list.hidden, true);
  assert.equal(input.getAttribute('aria-activedescendant'), null);
});
test('empty matches and shortened query cannot retain stale keyboard selection', () => {
  const { input, list, navigations } = fixture();
  query(input); input.fire('keydown', { key: 'ArrowDown' });
  query(input, 'unmatched');
  input.fire('keydown', { key: 'ArrowUp' });
  assert.equal(input.getAttribute('aria-activedescendant'), null);
  assert.equal(list.hidden, true);
  query(input, 'a'); input.fire('keydown', { key: 'Enter' });
  assert.equal(navigations.length, 0);
});
test('select mode preserves comparison event contract and input focus', () => {
  globalThis.CustomEvent ||= class { constructor(type, init) { this.type = type; Object.assign(this, init); } };
  const { input, box, list } = fixture({ select: true });
  query(input); input.fire('keydown', { key: 'ArrowDown' }); input.fire('keydown', { key: 'Enter' });
  assert.equal(box.lastEvent.type, 'search:select');
  assert.equal(box.lastEvent.detail.slug, 'airsense-11');
  assert.equal(box.lastEvent.bubbles, true);
  assert.equal(input.value, '');
  assert.equal(list.hidden, true);
  assert.equal(document.activeElement, input);
});
test('full results reads URL filters, updates URL, and shows complete result count', () => {
  const { input, list, status, box, type } = fixture({ full: true, search: '?q=airsense&market=us&type=guide' });
  assert.equal(input.value, 'airsense');
  assert.equal(list.children.length, 1);
  assert.equal(status.textContent, '1 result.');
  assert.equal(box.currentUrl, '/search/?q=airsense&market=us&type=guide');
  type.value = 'device'; type.fire('change');
  assert.equal(list.hidden, true);
  assert.match(status.textContent, /No results/);
});
test('load failure shows retry; retry succeeds without reopening an unfocused popup', async () => {
  let count = 0;
  globalThis.fetch = async () => ({ ok: ++count > 1, json: async () => [{ m: 'in', t: 'c', n: 'Oxygen therapy', h: '/clinical/oxygen/' }] });
  const { input, list, retry, status } = fixture({ remote: true });
  query(input, 'oxygen');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(retry.hidden, false);
  assert.match(status.textContent, /could not load/);
  assert.equal(input.getAttribute('aria-busy'), null);
  retry.fire('click');
  document.activeElement = new Element('button');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(count, 2);
  assert.equal(retry.hidden, true);
  assert.equal(list.hidden, true);
  input.focus();
  assert.equal(list.hidden, false);
  assert.equal(list.children.length, 1);
});
