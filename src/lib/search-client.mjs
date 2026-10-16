import { MARKET_LABELS, TYPE_LABELS, TYPE_CODES, loadSearchIndex, prepareSearchItem, rankSearch } from './search-core.mjs';

export function initializeSearchBox(box) {
  if (box.dataset.searchInit === '1') return;
  box.dataset.searchInit = '1';
  const input = box.querySelector('input');
  const list = box.querySelector('[role="listbox"]');
  const status = box.querySelector('[role="status"]');
  const retry = box.querySelector('.searchbox__retry');
  const allLink = box.querySelector('.searchbox__all');
  const marketSelect = box.querySelector('.searchbox__market');
  const typeSelect = box.querySelector('.searchbox__type');
  const full = box.dataset.fullResults === 'true';
  const src = box.dataset.src;
  const minChars = Number(box.dataset.minChars) || 2;
  const maxResults = Number(box.dataset.maxResults) || 8;
  let market = box.dataset.market || 'all';
  let resultType = box.dataset.target === 'select' ? 'device' : box.dataset.resultType || 'all';
  let items = [];
  let results = [];
  let active = -1;
  let ready = !src;
  let pending;
  if (!input || !list || !status || !retry) return;
  if (!src) {
    try { items = JSON.parse(box.querySelector('.searchbox__data')?.textContent || '[]').map(prepareSearchItem); }
    catch { ready = false; }
  }
  if (full) {
    const params = new URLSearchParams(window.location.search);
    input.value = params.get('q') || '';
    const requestedMarket = params.get('market');
    const requestedType = params.get('type');
    if (requestedMarket === 'all' || MARKET_LABELS[requestedMarket]) market = requestedMarket;
    if (requestedType === 'all' || TYPE_CODES[requestedType]) resultType = requestedType;
    marketSelect.value = market;
    typeSelect.value = resultType;
  }
  function setActive(index) {
    active = index;
    Array.from(list.children).forEach((option, i) => {
      const selected = i === active;
      option.setAttribute('aria-selected', String(selected));
      option.classList.toggle('searchbox__item--active', selected);
    });
    if (active >= 0 && list.children[active]) {
      input.setAttribute('aria-activedescendant', list.children[active].id);
      list.children[active].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }
  function searchHref() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set('q', input.value.trim());
    if (market !== 'all') params.set('market', market);
    if (resultType !== 'all') params.set('type', resultType);
    return '/search/' + (params.size ? '?' + params.toString() : '');
  }
  function update() {
    if (allLink) allLink.href = searchHref();
    if (full) window.history.replaceState(null, '', searchHref());
    if (!ready) return;
    const query = input.value.trim();
    if (!full && query.length < minChars) {
      results = [];
      close();
      status.textContent = query ? `Enter at least ${minChars} characters to search.` : '';
      return;
    }
    const matches = rankSearch(items, query, { market, resultType });
    results = full ? matches : matches.slice(0, maxResults);
    list.replaceChildren();
    for (const [index, item] of results.entries()) {
      const option = document.createElement('li');
      option.id = `${box.dataset.searchId}-option-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.dataset.index = String(index);
      const action = document.createElement(box.dataset.target === 'select' ? 'button' : 'a');
      action.className = 'searchbox__result';
      action.tabIndex = -1;
      if (action.tagName === 'A') action.href = item.href;
      else action.type = 'button';
      const marker = document.createElement('span');
      marker.className = 'searchbox__noimg';
      marker.setAttribute('aria-hidden', 'true');
      if (item.image) {
        const image = document.createElement('img');
        image.src = item.image;
        image.alt = '';
        image.loading = 'lazy';
        marker.append(image);
      }
      const body = document.createElement('span');
      body.className = 'searchbox__result-body';
      const name = document.createElement('span');
      name.className = 'searchbox__result-name';
      name.textContent = item.name;
      const meta = document.createElement('span');
      meta.className = 'searchbox__result-meta';
      meta.textContent = [TYPE_LABELS[item.type], MARKET_LABELS[item.market], item.brand,
        item.discontinued ? 'Discontinued' : item.price].filter(Boolean).join(' · ');
      body.append(name, meta);
      action.append(marker, body);
      option.append(action);
      list.append(option);
    }
    setActive(-1);
    // A pending fetch must not reopen suggestions after the reader has left the input.
    list.hidden = !results.length || (!full && document.activeElement !== input);
    input.setAttribute('aria-expanded', String(!list.hidden));
    status.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}${full || matches.length <= maxResults ? '.' : `; showing the first ${maxResults}. Open all results to see more.`}`
      : 'No results. Try a brand, device type or topic, or change the filters.';
  }
  async function load() {
    if (ready) { update(); return; }
    if (pending || !src) return pending;
    status.textContent = 'Loading search…';
    input.setAttribute('aria-busy', 'true');
    retry.hidden = true;
    pending = loadSearchIndex(src).then((loaded) => {
      items = loaded;
      ready = true;
      update();
    }).catch(() => {
      close();
      status.textContent = 'Search could not load. Retry or browse all devices and articles.';
      retry.hidden = false;
    }).finally(() => {
      pending = undefined;
      input.removeAttribute('aria-busy');
    });
    return pending;
  }
  function choose(index) {
    const item = results[index];
    if (!item) return;
    if (box.dataset.target === 'select') {
      box.dispatchEvent(new CustomEvent('search:select', { detail: item, bubbles: true }));
      input.value = '';
      results = [];
      close();
      status.textContent = `${item.name} selected.`;
      input.focus();
    } else window.location.assign(item.href);
  }
  input.addEventListener('input', () => { update(); if (!ready) load(); });
  input.addEventListener('focus', () => { update(); if (!ready) load(); });
  retry.addEventListener('click', () => { input.focus(); load(); });
  marketSelect?.addEventListener('change', () => { market = marketSelect.value; update(); });
  typeSelect?.addEventListener('change', () => { resultType = typeSelect.value; update(); });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close(); // Keep focus in the combobox, as required by the ARIA pattern.
    } else if (event.key === 'Tab') {
      if (!full) close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!ready) { load(); return; }
      if (list.hidden) update();
      if (!results.length) return;
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const next = event.key === 'ArrowDown'
        ? (active + 1) % results.length
        : (active <= 0 ? results.length - 1 : active - 1);
      setActive(next);
    } else if ((event.key === 'Home' || event.key === 'End') && active >= 0 && !list.hidden) {
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : results.length - 1);
    } else if (event.key === 'Enter') {
      if (!list.hidden && active >= 0) { event.preventDefault(); choose(active); }
      else if (!full && box.dataset.target !== 'select' && input.value.trim().length >= minChars) {
        event.preventDefault();
        window.location.assign(searchHref());
      }
    }
  });
  // Preserve input focus for pointer selection without interfering with link clicks.
  list.addEventListener('pointerdown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const option = event.target.closest('[role="option"]');
    if (option && box.dataset.target === 'select') {
      event.preventDefault();
      choose(Number(option.dataset.index));
    }
  });
  box.addEventListener('focusout', (event) => {
    if (!box.contains(event.relatedTarget) && !full) close();
  });
  if (full) load();
  else update();
}
