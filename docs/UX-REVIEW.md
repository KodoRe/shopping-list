# Shopping List ("Home Kitchen") — UX & Usability Review

> Reviewer: Neo (senior eng/design partner)
> Date: 2026-06-07
> Build reviewed: cloned from `KodoRe/shopping-list` → `/data/projects/shopping-list`
> Method: served locally, drove all 4 tabs, read `app.js` + `style.css` to back findings with code.

---

## TL;DR

A 4-tab **"Home Kitchen"** app (List · Recipes · Pantry · Guided Cooking). Good design
instincts and a coherent concept, but **not usable right now** for two fixable reasons:
the backend is gone, and there is no offline fallback to survive that.

---

## 🔴 Blocker: the backend is dead

- App talks to Supabase project `nepqlkhatppvbvmnyvxn.supabase.co`, which **no longer
  resolves** (NXDOMAIN from public DNS 8.8.8.8) → project deleted or paused. Not a VM
  network issue (github/google/supabase.com all resolve fine).
- **Add silently fails.** Typed "3 apples", hit +, item vanished — no item, no error.
  `addItem` does the server write *first*, only renders on success.
- **"Failed to load ❌" toast fires every 30s, forever** (`setInterval(loadData, 30000)`
  hitting the dead backend).
- **README lies:** claims *"localStorage for offline use"* — there is **zero localStorage
  in the code**. App is 100% backend-dependent.

## 🟢 What's genuinely good (once populated)

- Clean, modern card rows; round checkboxes; phone-shaped (560px, centers on desktop).
- **Auto-categorization works** (apples→🥬, chicken→🥩, milk→🧀) via keyword map.
- **"By Aisle" view is the standout** — groups items by store-walk order. Genuinely useful.
- Checked items: green check + strikethrough + fade. Clear.
- Optimistic UI on toggle/remove (instant, reverts on failure) — oddly NOT used for add.

## 🟡 Real usability gaps

- **Last list item hides behind the fixed bottom nav** (`position:fixed`, content
  `padding-bottom:0`). Real bug on phones — the primary device.
- **No way to create a recipe in the app.** Recipes & Cook tabs are read-only → 2 of 4
  tabs are permanently empty for a normal user. Pantry at least has an add button.
- **Filter pills overflow** — "Dessert" cut off at screen edge, no scroll cue.
- **No loading states** — just the failure toast.

---

## Highest-value fixes (priority order)

1. **Offline-first with localStorage** (already promised in README). One change → app works
   with backend down, and add-item stops silently failing.
2. **Fix bottom-nav overlap** (content `padding-bottom`).
3. **Add a recipe-creation UI** (unlocks 2 dead tabs).
4. **Stop the 30s error toast when offline** (debounce / offline mode).

## Verdict

Design instincts are good; the aisle-grouping is smart; the 4-in-1 concept is appealing.
But it's a brick right now. Offline-first + the add-item silent-fail are the tight,
high-impact pair to fix first.
