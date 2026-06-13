// local-api.js — VM-side sync backend for the Store.
// ---------------------------------------------------
// Drop-in replacement for the old `supabase` client. Same method surface, so
// store.js doesn't know or care which backend it's talking to:
//
//   getItems / addItem / updateItem / deleteItem
//   getRecipes / addRecipe / updateRecipe
//   getPantry / addPantryItem / deletePantryItem
//   subscribeToItems(cb)
//
// Talks to the local server (server.py) over SAME-ORIGIN fetch (relative /api
// paths). That means it works identically on http://127.0.0.1:9210 and through
// the Tailscale HTTPS proxy — no hostnames baked in, no CORS.
//
// CONTRACT WITH THE STORE: on any network/HTTP failure these methods THROW.
// That's deliberate — store.hydrate() treats a throwing backend as "offline"
// and keeps localStorage as the source of truth. The app never blocks on us.

(function (global) {
  'use strict';

  const API = '/api';
  const TIMEOUT_MS = 6000;

  async function http(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  // POST returns an array (the server echoes saved rows); callers that add a
  // single record expect that record back, so unwrap a 1-element array.
  function one(arr) {
    return Array.isArray(arr) ? arr[0] : arr;
  }

  const LocalAPI = {
    // ---- items ----
    async getItems() { return (await http('GET', '/items')) || []; },
    async addItem(item) { return one(await http('POST', '/items', item)); },
    async updateItem(id, updates) { return await http('PATCH', `/items/${id}`, updates); },
    async deleteItem(id) { return await http('DELETE', `/items/${id}`); },

    // ---- recipes ----
    async getRecipes() { return (await http('GET', '/recipes')) || []; },
    async addRecipe(recipe) { return one(await http('POST', '/recipes', recipe)); },
    async updateRecipe(id, updates) { return await http('PATCH', `/recipes/${id}`, updates); },

    // ---- pantry ----
    async getPantry() { return (await http('GET', '/pantry')) || []; },
    async addPantryItem(item) { return one(await http('POST', '/pantry', item)); },
    async updatePantryItem(id, updates) { return await http('PATCH', `/pantry/${id}`, updates); },
    async deletePantryItem(id) { return await http('DELETE', `/pantry/${id}`); },

    // ---- realtime ----
    // No websocket on the local server (overkill for a single-household app).
    // The app already polls via setInterval(syncData, …) and re-hydrates on
    // window focus (slice 3), so injected data shows up within seconds. We keep
    // the method so store/app code paths that reference it stay happy.
    subscribeToItems(_callback) { /* polling-based; intentional no-op */ },

    // Lightweight liveness probe used by the UI status dot if it wants one.
    async health() {
      try { return !!(await http('GET', '/health')); } catch (e) { return false; }
    },
  };

  global.LocalAPI = LocalAPI;
  if (typeof module !== 'undefined' && module.exports) module.exports = LocalAPI;

})(typeof window !== 'undefined' ? window : globalThis);
