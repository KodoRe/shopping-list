# Home Kitchen

An offline-first shopping list, pantry, recipe box, and guided-cooking app.
Pure HTML/CSS/JS — no build step, no framework.

## Features

- **Shopping list** with auto-categorization (apples → Produce, milk → Dairy, …)
  and a "By Aisle" view that groups items in store-walk order.
- **Pantry** tracking so staples you already own aren't re-added.
- **Recipes** — create your own in-app (name, meal tag, servings, time,
  ingredients, steps), pull missing ingredients straight onto the shopping list.
- **Guided Cooking** — step-by-step mode with an ingredient checklist and progress bar.
- **Dark mode** — toggle in the header; remembers your choice and respects your
  system preference on first run.

## Offline-first

**localStorage is the source of truth.** The app works fully offline — add items,
create recipes, manage the pantry — and everything persists on the device across
reloads. There is no dependency on a live backend to function.

When a sync backend (Supabase) is reachable, the app uses it as a best-effort sync
target: local changes are queued and flushed in the background, and remote changes
are merged in. A small dot next to the title shows status (green = synced,
grey = offline). When the backend is unreachable, the app simply stays local —
no errors, no nagging, no data loss.

> Note: the optional Supabase backend referenced in `config.js` may be inactive.
> The app is designed to work regardless — offline-first is the default, not a fallback.

## Architecture

- `index.html` — markup + the four tabs (List, Recipes, Pantry, Cook).
- `style.css` — token-driven "Market" theme. All components reference CSS custom
  properties, so the light/dark palettes live in two `:root` / `[data-theme="dark"]`
  blocks at the top.
- `js/store.js` — the offline-first data layer (localStorage truth + write-queue +
  best-effort Supabase sync). Framework-free and unit-tested.
- `js/test-store.js` — node unit tests for the store (`node js/test-store.js`).
- `app.js` — UI logic: rendering, the add/edit flows, recipe form, theme toggle.
- `supabase-client.js` / `config.js` — the optional sync backend client + config.

## Design

"Market" theme: bold and fresh — terracotta-orange brand, neutral-grey canvas,
Space Grotesk type, colour-coded category bars, and a full dark mode. The app is
phone-shaped (max 560px) and centers on larger screens.

## Run locally

```bash
python3 -m http.server 9210 --bind 127.0.0.1
# then open http://127.0.0.1:9210
```

## Tests

```bash
node js/test-store.js   # offline + online data-layer assertions
```
