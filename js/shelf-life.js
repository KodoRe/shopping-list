// shelf-life.js — client-side expiry estimation (mirrors server.py's estimator).
// ---------------------------------------------------------------------------
// WHY a second copy of this logic: the server is the authority on expiry, but
// offline-first means a freshly-stocked pantry item is written to localStorage
// OPTIMISTICALLY, before any server round-trip. If we waited for the server, the
// expiry warning (slice 3) wouldn't appear until the next sync — a laggy UX.
//
// So we estimate client-side too, stamp the optimistic write, and let the server's
// authoritative value overwrite ours on the next hydrate (they use the same map +
// same longest-keyword-wins rule, so they agree). The shelf-life map is fetched
// once from /data/shelf-life.json — single source of truth for the numbers.

(function (global) {
  'use strict';

  let MAP = {};            // keyword → days
  let SORTED_KEYS = [];    // keys longest-first (longest/most-specific match wins)
  let DEFAULT_DAYS = 14;
  let loaded = false;

  async function load() {
    if (loaded) return;
    try {
      const res = await fetch('/data/shelf-life.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.map === 'object') {
          MAP = data.map;
          DEFAULT_DAYS = Number(data._default) || 14;
          SORTED_KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
          loaded = true;
        }
      }
    } catch (e) { /* offline / missing → fall back to flat default below */ }
  }

  // Estimated shelf life in days for a product name. Longest keyword substring wins.
  function estimateDays(name) {
    if (!name) return DEFAULT_DAYS;
    const low = name.toLowerCase();
    for (const kw of SORTED_KEYS) {
      if (low.includes(kw)) return MAP[kw];
    }
    return DEFAULT_DAYS;
  }

  // ISO expiry = stockedAt (or now) + estimated shelf life.
  function computeExpiry(name, stockedAtIso) {
    const base = stockedAtIso ? new Date(stockedAtIso) : new Date();
    const start = isNaN(base.getTime()) ? new Date() : base;
    const exp = new Date(start.getTime() + estimateDays(name) * 86400000);
    return exp.toISOString();
  }

  // Build the expiry fields for an optimistic pantry write.
  function stampExpiry(name, stockedAtIso) {
    const stocked = stockedAtIso || new Date().toISOString();
    return {
      shelf_life_days: estimateDays(name),
      stocked_at: stocked,
      expires_at: computeExpiry(name, stocked),
    };
  }

  global.ShelfLife = { load, estimateDays, computeExpiry, stampExpiry };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ShelfLife;

})(typeof window !== 'undefined' ? window : globalThis);
