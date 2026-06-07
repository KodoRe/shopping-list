# Market Redesign + Offline-First — Implementation Plan

> Branch: `feature/market-redesign-offline-first` · Date: 2026-06-07
> Reviewer/architect: Neo · Approved by: Nitai ("lock it - market theme, bundle the functional fixes")

## Goal

Ship the **Market** visual redesign (terracotta-orange brand, neutral-grey canvas,
Space Grotesk, dark mode, food imagery) **and** fix the functional defects from the UX
review in one branch → one PR to `main`.

## Problem statement (agreed)

The app is well-built but (1) 100% dependent on a Supabase backend that's currently
**dead** (NXDOMAIN), so add silently fails and a failure toast fires every 30s; (2) has
no in-app recipe creation, leaving Recipes + Cook tabs permanently empty; (3) has a
fixed bottom-nav that can hide the last list item; and (4) looks competent but
characterless. The README falsely claims localStorage offline support.

## Acceptance criteria

- [ ] **Offline-first:** with the backend down, I can add/toggle/delete items, add pantry
      items, and create recipes — all persist across reload via `localStorage`. No data loss.
- [ ] **Add never silently fails:** item appears instantly (optimistic), persists locally,
      syncs to backend when reachable.
- [ ] **No 30s error-toast spam** when offline. Sync failures are silent/non-nagging;
      a subtle status indicator communicates offline state instead.
- [ ] **Recipe creation in-app:** a "+" on the Recipes tab opens a form (name, meal tag,
      servings, time, ingredients, steps); saved recipe shows in Recipes + Cook.
- [ ] **Bottom-nav overlap fixed:** last list item fully visible above the nav on a phone
      viewport (verified empirically, computed styles + screenshot).
- [ ] **Market re-skin live:** orange brand, grey canvas, Space Grotesk, category row-bars,
      food-imagery recipe cards, working light/dark toggle persisted in localStorage.
- [ ] **README truthful** about offline behavior.
- [ ] All JS passes `node --check`. Headless: zero console errors, both themes verified.

## Non-goals (this round)

- No Supabase project resurrection (separate backend task; app must work without it).
- No Telegram-bot / Watson changes.
- No build tooling / framework migration — stays vanilla JS, static files.
- No PWA/service-worker offline (localStorage is enough; SW is a later stretch).
- No new recipe *editing/deletion* beyond create (YAGNI; add later if wanted).

## Architecture

**Central move: introduce a `Store` layer (localStorage = source of truth) that wraps the
existing `supabase` client as a best-effort sync target.** `app.js` stops calling
`supabase.*` directly and calls `Store.*` instead. The Supabase method seam
(`getItems/addItem/updateItem/deleteItem/...`) is clean, so the wrap is mechanical.

- **Reads:** `Store.getItems()` returns from localStorage instantly; a background
  `Store.hydrate()` tries Supabase and, on success, merges + repaints.
- **Writes:** mutate localStorage immediately (optimistic), enqueue a pending op, attempt
  to flush to Supabase in the background. Offline → stays queued, retried on next hydrate.
- **IDs:** generate client-side IDs (`crypto.randomUUID()`) so items exist without a server
  round-trip. Server reconciliation keyed on id.
- **Status:** `Store.online` boolean + a tiny header dot (green=synced, grey=offline)
  replaces the nagging toast.

This is the boring, reversible version: if Supabase comes back, sync resumes automatically;
if it never does, the app is fully functional locally.

## Slices (each = its own commit, verified before commit)

1. **`js/store.js`** — offline-first data layer. localStorage truth, hydrate(), write-queue,
   online flag. Pure module, unit-testable in isolation with `node`.
2. **Wire `app.js` → Store.** Replace `supabase.*` calls; make `addItem` optimistic;
   replace `setInterval(loadData, 30000)` failure-toast path with silent hydrate + status dot.
3. **Recipe-creation UI.** "+" header button on Recipes tab → form view → `Store.addRecipe`.
4. **Bottom-nav overlap** — verify empirically, fix padding if confirmed.
5. **Market re-skin** — port tokens from the approved mockup into `style.css`; add dark-mode
   toggle (persisted); food-imagery recipe cards; category row-bars; Space Grotesk.
6. **README truth-up** + full headless verification (both themes, offline proven), screenshots.
7. **PR to main.**

## Verification strategy

- Each slice: `node --check` all touched JS; serve headless; drive the real flow; confirm via
  **computed styles + console error count**, not just screenshots (lesson from the mockup bug).
- Offline proof: block the Supabase host (it's already NXDOMAIN) and show full CRUD persists
  across reload.

## Load-bearing assumption

That `localStorage` is acceptable as the durability layer for a family of ~2 adults sharing a
list. If real-time multi-device sync is a hard requirement, the dead backend must be revived —
but that's out of scope here and doesn't block shipping a working, good-looking app today.
