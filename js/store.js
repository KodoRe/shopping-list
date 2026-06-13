// store.js — Offline-first data layer for Home Kitchen
// -----------------------------------------------------
// localStorage is the SOURCE OF TRUTH. Supabase is a best-effort sync target.
//
// Why: the app must work even when the backend is down (it currently is — the
// Supabase project no longer resolves). Reads return from localStorage instantly;
// writes mutate localStorage immediately (optimistic) and are queued for background
// sync. When the backend is reachable, hydrate() pulls server state and flush()
// pushes queued ops. When it's not, everything still works locally and nothing is lost.
//
// This module is intentionally framework-free and dependency-light so it can be
// unit-tested under plain `node` (see the `module.exports` guard at the bottom).

(function (global) {
  'use strict';

  const LS_KEYS = {
    items: 'hk_items',
    recipes: 'hk_recipes',
    pantry: 'hk_pantry',
    queue: 'hk_pending_queue',
  };

  // --- storage primitives (degrade gracefully if localStorage is unavailable) ---
  const mem = {}; // fallback store for environments without localStorage (e.g. node tests)
  function lsGet(key) {
    try {
      if (global.localStorage) {
        const raw = global.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) { /* fall through to mem */ }
    return key in mem ? mem[key] : null;
  }
  function lsSet(key, val) {
    const json = JSON.stringify(val);
    try {
      if (global.localStorage) { global.localStorage.setItem(key, json); return; }
    } catch (e) { /* fall through to mem */ }
    mem[key] = JSON.parse(json);
  }

  // --- id generation (client-side, so records exist without a server round-trip) ---
  function uuid() {
    try {
      if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return 'loc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // --- the sync backend (injected; the existing `supabase` client). May be null. ---
  let backend = null;

  const Store = {
    online: false,
    _listeners: [],

    // Wire the sync backend and the change-notifier. `onChange` is called whenever
    // local state changes so the UI can repaint.
    init(syncBackend, onChange) {
      backend = syncBackend || null;
      if (typeof onChange === 'function') this._listeners.push(onChange);
      // Seed collections if first run.
      if (lsGet(LS_KEYS.items) === null) lsSet(LS_KEYS.items, []);
      if (lsGet(LS_KEYS.recipes) === null) lsSet(LS_KEYS.recipes, []);
      if (lsGet(LS_KEYS.pantry) === null) lsSet(LS_KEYS.pantry, []);
      if (lsGet(LS_KEYS.queue) === null) lsSet(LS_KEYS.queue, []);
      return this;
    },

    _emit() { this._listeners.forEach(fn => { try { fn(); } catch (e) {} }); },

    // ---- synchronous local reads (source of truth) ----
    getItems() { return lsGet(LS_KEYS.items) || []; },
    getRecipes() { return lsGet(LS_KEYS.recipes) || []; },
    getPantry() { return lsGet(LS_KEYS.pantry) || []; },

    // ---- pending write queue ----
    _queue() { return lsGet(LS_KEYS.queue) || []; },
    _enqueue(op) { const q = this._queue(); q.push(op); lsSet(LS_KEYS.queue, q); },
    pendingCount() { return this._queue().length; },

    // ---- ITEMS ----
    addItem(fields) {
      const item = Object.assign(
        { id: uuid(), checked: false, created_at: new Date().toISOString() },
        fields
      );
      const items = this.getItems();
      items.push(item);
      lsSet(LS_KEYS.items, items);
      this._enqueue({ kind: 'addItem', table: 'items', id: item.id, payload: item });
      this._emit();
      this._flushSoon();
      return item; // returned synchronously — caller never waits on the network
    },

    updateItem(id, updates) {
      const items = this.getItems();
      const it = items.find(i => i.id === id);
      if (!it) return null;
      Object.assign(it, updates);
      lsSet(LS_KEYS.items, items);
      this._enqueue({ kind: 'updateItem', table: 'items', id, payload: updates });
      this._emit();
      this._flushSoon();
      return it;
    },

    removeItem(id) {
      let items = this.getItems();
      const before = items.length;
      items = items.filter(i => i.id !== id);
      if (items.length === before) return false;
      lsSet(LS_KEYS.items, items);
      this._enqueue({ kind: 'removeItem', table: 'items', id });
      this._emit();
      this._flushSoon();
      return true;
    },

    clearChecked() {
      const checked = this.getItems().filter(i => i.checked);
      checked.forEach(i => {
        // remove locally + queue a delete, but don't emit/flush per-item
        let items = this.getItems().filter(x => x.id !== i.id);
        lsSet(LS_KEYS.items, items);
        this._enqueue({ kind: 'removeItem', table: 'items', id: i.id });
      });
      this._emit();
      this._flushSoon();
      return checked.length;
    },

    // ---- PANTRY ----
    addPantryItem(fields) {
      const p = Object.assign(
        { id: uuid(), created_at: new Date().toISOString() }, fields
      );
      const pantry = this.getPantry();
      pantry.push(p);
      lsSet(LS_KEYS.pantry, pantry);
      this._enqueue({ kind: 'addPantryItem', table: 'pantry', id: p.id, payload: p });
      this._emit();
      this._flushSoon();
      return p;
    },

    removePantryItem(id) {
      let pantry = this.getPantry();
      const before = pantry.length;
      pantry = pantry.filter(i => i.id !== id);
      if (pantry.length === before) return false;
      lsSet(LS_KEYS.pantry, pantry);
      this._enqueue({ kind: 'removePantryItem', table: 'pantry', id });
      this._emit();
      this._flushSoon();
      return true;
    },

    updatePantryItem(id, updates) {
      const pantry = this.getPantry();
      const p = pantry.find(i => i.id === id);
      if (!p) return null;
      Object.assign(p, updates);
      lsSet(LS_KEYS.pantry, pantry);
      this._enqueue({ kind: 'updatePantryItem', table: 'pantry', id, payload: updates });
      this._emit();
      this._flushSoon();
      return p;
    },

    // ---- RECIPES ----
    addRecipe(fields) {
      const r = Object.assign(
        { id: uuid(), created_at: new Date().toISOString() }, fields
      );
      const recipes = this.getRecipes();
      recipes.unshift(r); // newest first, matches server order
      lsSet(LS_KEYS.recipes, recipes);
      this._enqueue({ kind: 'addRecipe', table: 'recipes', id: r.id, payload: r });
      this._emit();
      this._flushSoon();
      return r;
    },

    // ---- SYNC ----
    // Pull server state (best effort). On success, server rows win for records that
    // exist on both sides; purely-local records (still queued) are preserved.
    async hydrate() {
      if (!backend) { this.online = false; this._emit(); return; }
      try {
        const [si, sr] = await Promise.all([
          backend.getItems().catch(() => null),
          backend.getRecipes().catch(() => null),
        ]);
        let sp = null;
        try { sp = await backend.getPantry(); } catch (e) { sp = null; }

        // If the very first read fails, we're offline — keep local, bail quietly.
        if (si === null && sr === null && sp === null) {
          this.online = false; this._emit(); return;
        }
        this.online = true;

        const queuedIds = new Set(this._queue().map(op => op.id));
        if (Array.isArray(si)) lsSet(LS_KEYS.items, this._merge(this.getItems(), si, queuedIds));
        if (Array.isArray(sr)) lsSet(LS_KEYS.recipes, this._merge(this.getRecipes(), sr, queuedIds));
        if (Array.isArray(sp)) lsSet(LS_KEYS.pantry, this._merge(this.getPantry(), sp, queuedIds));

        await this.flush();
        this._emit();
      } catch (e) {
        this.online = false;
        this._emit();
      }
    },

    // Merge server rows with local, preserving local records that are still queued
    // (not yet acknowledged by the server).
    _merge(local, server, queuedIds) {
      const byId = new Map();
      server.forEach(r => byId.set(r.id, r));         // server baseline
      local.forEach(l => { if (queuedIds.has(l.id)) byId.set(l.id, l); }); // local pending wins
      return Array.from(byId.values());
    },

    // Push queued ops to the backend. Successful ops are dropped from the queue;
    // failed ops stay for the next attempt.
    async flush() {
      if (!backend) return;
      const q = this._queue();
      if (!q.length) return;
      const remaining = [];
      for (const op of q) {
        try {
          await this._apply(op);
        } catch (e) {
          remaining.push(op); // keep for retry
        }
      }
      lsSet(LS_KEYS.queue, remaining);
    },

    async _apply(op) {
      switch (op.kind) {
        case 'addItem': return backend.addItem(op.payload);
        case 'updateItem': return backend.updateItem(op.id, op.payload);
        case 'removeItem': return backend.deleteItem(op.id);
        case 'addPantryItem': return backend.addPantryItem(op.payload);
        case 'updatePantryItem': return backend.updatePantryItem(op.id, op.payload);
        case 'removePantryItem': return backend.deletePantryItem(op.id);
        case 'addRecipe': return backend.addRecipe(op.payload);
        default: return null;
      }
    },

    // Debounced background flush so rapid edits don't fire N parallel requests.
    _flushTimer: null,
    _flushSoon() {
      if (!backend) return;
      try {
        if (this._flushTimer) clearTimeout(this._flushTimer);
        this._flushTimer = setTimeout(() => { this.flush().catch(() => {}); }, 400);
      } catch (e) { /* setTimeout always exists in browser; ignore in odd envs */ }
    },

    // test helper: wipe everything (used by unit tests)
    _reset() {
      lsSet(LS_KEYS.items, []); lsSet(LS_KEYS.recipes, []);
      lsSet(LS_KEYS.pantry, []); lsSet(LS_KEYS.queue, []);
    },
  };

  global.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;

})(typeof window !== 'undefined' ? window : globalThis);
