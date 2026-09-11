/* Static English/German copy. Translation never sends visitor data to a service. */
(() => {
  'use strict';
  const dictionary = window.PORTFOLIO_DE || {};
  const storageKey = 'aditya-portfolio-language';
  const root = document.documentElement;
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  const supported = value => value === 'en' || value === 'de';
  const dynamic = '[data-i18n-dynamic], [data-language-switch], script, style, code, pre';
  const textBindings = [];
  const attributeBindings = [];
  const englishTitle = document.title;
  const description = document.querySelector('meta[name="description"]');
  const englishDescription = description?.content;
  let language = 'en';

  function storedLanguage() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }
  function initialLanguage() {
    const requested = new URL(location.href).searchParams.get('lang');
    if (supported(requested)) return requested;
    const stored = storedLanguage();
    if (supported(stored)) return stored;
    return /^de(?:-|$)/i.test(navigator.language || '') ? 'de' : 'en';
  }
  function t(source) {
    if (language === 'en' || typeof source !== 'string') return source;
    const key = normalize(source);
    if (!Object.prototype.hasOwnProperty.call(dictionary, key)) return source;
    return (source.match(/^\s*/)?.[0] || '') + dictionary[key] + (source.match(/\s*$/)?.[0] || '');
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(dynamic) || !Object.prototype.hasOwnProperty.call(dictionary, normalize(node.data))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) textBindings.push({node: walker.currentNode, source: walker.currentNode.data});
  document.querySelectorAll('[aria-label], [title], [alt]').forEach(element => {
    if (element.closest(dynamic)) return;
    ['aria-label', 'title', 'alt'].forEach(name => {
      const source = element.getAttribute(name);
      if (source && Object.prototype.hasOwnProperty.call(dictionary, normalize(source))) attributeBindings.push({element, name, source});
    });
  });
  function updateURL() {
    try {
      const url = new URL(location.href);
      url.searchParams.set('lang', language);
      history.replaceState(history.state, '', url);
    } catch { /* File previews can restrict history updates. */ }
  }
  function setLanguage(next, {persist = true, updateAddress = true, announce = true} = {}) {
    if (!supported(next)) return;
    language = next;
    root.lang = next;
    root.dataset.language = next;
    textBindings.forEach(({node, source}) => { if (node.isConnected) node.data = t(source); });
    attributeBindings.forEach(({element, name, source}) => element.setAttribute(name, t(source)));
    document.title = t(englishTitle);
    if (description) description.content = t(englishDescription);
    document.querySelectorAll('[data-language-switch]').forEach(group => { group.hidden = false; });
    document.querySelectorAll('button[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === next)));
    if (persist) { try { localStorage.setItem(storageKey, next); } catch {} }
    if (updateAddress) updateURL();
    const status = document.getElementById('language-status');
    if (status) status.textContent = announce ? (next === 'de' ? 'Sprache auf Deutsch umgestellt.' : 'Language changed to English.') : '';
    window.dispatchEvent(new CustomEvent('portfolio:languagechange', {detail: {language: next}}));
  }
  window.portfolioI18n = Object.freeze({t, setLanguage, get language() { return language; }});
  document.querySelectorAll('button[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  window.addEventListener('storage', event => {
    if (event.key === storageKey && supported(event.newValue)) setLanguage(event.newValue, {persist:false});
  });
  window.addEventListener('popstate', () => setLanguage(initialLanguage(), {persist:false, updateAddress:false}));
  setLanguage(initialLanguage(), {persist:false, updateAddress:false, announce:false});
})();
