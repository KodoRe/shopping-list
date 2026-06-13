// Home Kitchen App - Full Featured
const CAT_INFO = {
  produce:{emoji:'🥬',label:'Produce',order:1},dairy:{emoji:'🧀',label:'Dairy',order:2},
  meat:{emoji:'🥩',label:'Meat & Fish',order:3},bakery:{emoji:'🍞',label:'Bakery',order:4},
  frozen:{emoji:'🧊',label:'Frozen',order:5},drinks:{emoji:'🥤',label:'Drinks',order:6},
  snacks:{emoji:'🍿',label:'Snacks',order:7},pantry:{emoji:'🥫',label:'Pantry',order:8},
  household:{emoji:'🧹',label:'Household',order:9},personal:{emoji:'🧴',label:'Personal Care',order:10},
  other:{emoji:'📦',label:'Other',order:11},
};

// --- i18n glue --------------------------------------------------------------
// Category display label, language-aware. Emoji stays language-neutral and is
// read from CAT_INFO directly; only the human label is translated.
function catLabel(c) {
  return (typeof I18n !== 'undefined') ? I18n.t('cat.' + c) : (CAT_INFO[c]?.label || c);
}

// Walk the static DOM and fill every data-i18n* hook from the string table.
// data-i18n      -> textContent
// data-i18n-ph   -> placeholder attribute
// data-i18n-aria -> aria-label attribute
// data-i18n-title-> title attribute
// Called once on init and again on every language change (idempotent).
function applyStaticI18n() {
  if (typeof I18n === 'undefined') return;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = I18n.t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', I18n.t(el.getAttribute('data-i18n-ph')));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', I18n.t(el.getAttribute('data-i18n-aria')));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', I18n.t(el.getAttribute('data-i18n-title')));
  });
}

// Language button shows the LANGUAGE YOU'D SWITCH TO (so EN users see "עב",
// Hebrew users see "EN"). Label is intentionally the script name, not translated.
function updateLangButton() {
  const btn = document.getElementById('btn-lang');
  if (!btn || typeof I18n === 'undefined') return;
  btn.textContent = I18n.getLang() === 'he' ? 'EN' : 'עב';
}

const AUTO_CAT = {
  apple:'produce',banana:'produce',tomato:'produce',potato:'produce',onion:'produce',
  garlic:'produce',lemon:'produce',lime:'produce',avocado:'produce',cucumber:'produce',
  pepper:'produce',lettuce:'produce',carrot:'produce',broccoli:'produce',spinach:'produce',
  mushroom:'produce',orange:'produce',strawberry:'produce',grape:'produce',mango:'produce',
  ginger:'produce',cilantro:'produce',parsley:'produce',basil:'produce',corn:'produce',
  celery:'produce',zucchini:'produce',eggplant:'produce',
  milk:'dairy',cheese:'dairy',yogurt:'dairy',butter:'dairy',cream:'dairy',eggs:'dairy',
  egg:'dairy',cottage:'dairy',mozzarella:'dairy',cheddar:'dairy',parmesan:'dairy',
  chicken:'meat',beef:'meat',pork:'meat',fish:'meat',salmon:'meat',tuna:'meat',
  turkey:'meat',steak:'meat',shrimp:'meat',bacon:'meat',sausage:'meat',
  bread:'bakery',pita:'bakery',tortilla:'bakery',challah:'bakery',bagel:'bakery',
  'ice cream':'frozen',pizza:'frozen',
  water:'drinks',juice:'drinks',soda:'drinks',coffee:'drinks',tea:'drinks',beer:'drinks',wine:'drinks',
  chips:'snacks',crackers:'snacks',cookies:'snacks',chocolate:'snacks',nuts:'snacks',
  rice:'pantry',pasta:'pantry',flour:'pantry',sugar:'pantry',oil:'pantry',salt:'pantry',
  sauce:'pantry',beans:'pantry',cereal:'pantry',honey:'pantry',tahini:'pantry',hummus:'pantry',
  soap:'household',detergent:'household',sponge:'household',foil:'household',
  shampoo:'personal',toothpaste:'personal',deodorant:'personal','toilet paper':'personal',
};

// Basic nutritional data per 100g (approximate)
const NUTRITION_DB = {
  chicken:{cal:165,protein:31,carbs:0,fat:3.6},beef:{cal:250,protein:26,carbs:0,fat:15},
  salmon:{cal:208,protein:20,carbs:0,fat:13},egg:{cal:155,protein:13,carbs:1.1,fat:11},
  eggs:{cal:155,protein:13,carbs:1.1,fat:11},rice:{cal:130,protein:2.7,carbs:28,fat:0.3},
  pasta:{cal:131,protein:5,carbs:25,fat:1.1},bread:{cal:265,protein:9,carbs:49,fat:3.2},
  milk:{cal:42,protein:3.4,carbs:5,fat:1},cheese:{cal:402,protein:25,carbs:1.3,fat:33},
  butter:{cal:717,protein:0.9,carbs:0.1,fat:81},potato:{cal:77,protein:2,carbs:17,fat:0.1},
  tomato:{cal:18,protein:0.9,carbs:3.9,fat:0.2},onion:{cal:40,protein:1.1,carbs:9.3,fat:0.1},
  garlic:{cal:149,protein:6.4,carbs:33,fat:0.5},olive:{cal:119,protein:0.8,carbs:6.3,fat:11},
  oil:{cal:884,protein:0,carbs:0,fat:100},sugar:{cal:387,protein:0,carbs:100,fat:0},
  flour:{cal:364,protein:10,carbs:76,fat:1},apple:{cal:52,protein:0.3,carbs:14,fat:0.2},
  banana:{cal:89,protein:1.1,carbs:23,fat:0.3},carrot:{cal:41,protein:0.9,carbs:10,fat:0.2},
  broccoli:{cal:34,protein:2.8,carbs:7,fat:0.4},spinach:{cal:23,protein:2.9,carbs:3.6,fat:0.4},
  avocado:{cal:160,protein:2,carbs:9,fat:15},lemon:{cal:29,protein:1.1,carbs:9.3,fat:0.3},
  cream:{cal:340,protein:2,carbs:3,fat:36},yogurt:{cal:59,protein:10,carbs:3.6,fat:0.4},
  honey:{cal:304,protein:0.3,carbs:82,fat:0},bacon:{cal:541,protein:37,carbs:1.4,fat:42},
  shrimp:{cal:99,protein:24,carbs:0.2,fat:0.3},tofu:{cal:76,protein:8,carbs:1.9,fat:4.8},
};

function guessCategory(name) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(AUTO_CAT)) { if (l.includes(k)) return v; }
  return 'other';
}

function estimateNutrition(ingredients) {
  let totals = { cal: 0, protein: 0, carbs: 0, fat: 0 };
  (ingredients || []).forEach(ing => {
    const l = ing.name.toLowerCase();
    for (const [food, n] of Object.entries(NUTRITION_DB)) {
      if (l.includes(food)) {
        // Rough estimate: assume ~150g per ingredient
        const factor = 1.5;
        totals.cal += Math.round(n.cal * factor);
        totals.protein += Math.round(n.protein * factor);
        totals.carbs += Math.round(n.carbs * factor);
        totals.fat += Math.round(n.fat * factor);
        break;
      }
    }
  });
  return totals;
}

// State
let items = [], recipes = [], pantryItems = [];
let viewMode = 'list', recipeFilter = 'all';
// The sync backend, resolved at init. LocalAPI (server.py) is preferred; the old
// supabase global is a legacy fallback if local-api.js isn't present. store.js is
// backend-agnostic — it only needs the documented method surface.
let Backend = null;

// ===== THEME (dark mode) =====
// Applied as early as possible to avoid a flash of the wrong theme.
const Theme = {
  KEY: 'hk_theme',
  get() {
    try { return localStorage.getItem(this.KEY); } catch (e) { return null; }
  },
  // Resolve effective theme: saved choice → system preference → light.
  resolve() {
    const saved = this.get();
    if (saved === 'dark' || saved === 'light') return saved;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'light';
  },
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', I18n.t(theme === 'dark' ? 'action.themeLight' : 'action.themeDark'));
    }
  },
  init() { this.apply(this.resolve()); },
  toggle() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(this.KEY, next); } catch (e) {}
    this.apply(next);
  },
};
// Apply immediately (before DOMContentLoaded) so first paint is correct.
Theme.init();

// ===== DATA =====
// localStorage is the source of truth (via Store). Reads are synchronous and instant;
// the network is a best-effort sync that happens quietly in the background.
function loadLocal() {
  items = Store.getItems();
  recipes = Store.getRecipes();
  pantryItems = Store.getPantry();
  renderAll();
}

// Background sync. Never shows an error toast — offline is a normal state, not a failure.
// Updates the subtle status dot instead. Store.hydrate() repaints via its onChange hook.
async function syncData() {
  await Store.hydrate();          // pulls server state if reachable, flushes queued writes
  updateSyncStatus();
}

function updateSyncStatus() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  const pending = Store.pendingCount();
  if (Store.online) {
    dot.className = 'sync-dot online';
    dot.title = pending ? I18n.t('sync.pending', { count: pending }) : I18n.t('sync.synced');
    maybeSubscribeRealtime();   // only open the websocket once we know the backend is alive
  } else {
    dot.className = 'sync-dot offline';
    dot.title = I18n.t('sync.offline');
  }
}

// Open the realtime subscription exactly once, and only after a successful online
// sync. LocalAPI's subscribeToItems is a deliberate no-op (the app polls instead),
// so this won't open a socket against the local server. With the old supabase
// backend it avoided a perpetual 5s reconnect loop against a dead host.
let _realtimeWired = false;
function maybeSubscribeRealtime() {
  if (_realtimeWired) return;
  if (!Backend || typeof Backend.subscribeToItems !== 'function') return;
  _realtimeWired = true;
  try { Backend.subscribeToItems(() => syncData()); } catch (e) { _realtimeWired = false; }
}

function renderAll() { renderList(); renderRecipesList(); renderPantry(); renderCookSelect(); }

// ===== SHOPPING LIST =====
// All mutations go through Store: they apply to localStorage instantly (optimistic) and
// sync in the background. No await on the network → add can never silently fail.
function addItem(name, category, qty, addedBy) {
  if (!name.trim()) return;
  let parsedName = name.trim(), parsedQty = qty || '';
  if (!parsedQty) {
    let m;
    if ((m = parsedName.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(.+)$/))) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)) && !isNaN(m[1])) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(/^(.+?)\s*[xX](\d+(?:\.\d+)?)$/))) { parsedQty = m[2]; parsedName = m[1].trim(); }
    else if ((m = parsedName.match(/^(?:a\s+)?dozen\s+(.+)$/i))) { parsedQty = '12'; parsedName = m[1]; }
  }
  Store.addItem({
    name: parsedName, category: category || guessCategory(parsedName),
    qty: parsedQty, added_by: addedBy || 'app',
  });
  items = Store.getItems();
  renderList(); updateSyncStatus(); toast(I18n.t('toast.added', { name: parsedName }));
}

// Checkbox = pure check/uncheck toggle. It marks an item done (strike-through)
// and keeps it on the list. Stocking to the pantry is a separate, deliberate
// gesture (swipe-right) — see stockToPantry(). Conflating the two was a bug:
// a checkbox implies a reversible toggle, not a one-way move.
function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  Store.updateItem(id, { checked: !item.checked });
  items = Store.getItems();
  renderList(); updateSyncStatus();
}

// Swipe-right (or the explicit action) completes an item → moves it to the
// Pantry (Nitai's "Option A"), carrying its quantity (defaulting to 1 if blank
// so the pantry always shows a count). Dedupe bumps an existing row's qty
// instead of duplicating. An Undo toast reverses the whole move.
function stockToPantry(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  // Default a blank quantity to "1" — a stocked item is at least one of a thing,
  // and a missing count reads as a bug in the pantry. User can still edit it.
  const stockQty = (item.qty && String(item.qty).trim()) ? item.qty : '1';

  // Snapshot for undo BEFORE we mutate anything.
  const snapshot = { id: item.id, name: item.name, category: item.category, qty: item.qty,
                     added_by: item.added_by, checked: item.checked, created_at: item.created_at };

  // Dedupe by name (case-insensitive). If present, remember the prior qty so undo
  // can restore it exactly; else we'll remove the freshly-added pantry row on undo.
  const existing = pantryItems.find(p => p.name.toLowerCase() === item.name.toLowerCase());
  let pantryUndo;
  if (existing) {
    const priorQty = existing.qty || '';
    Store.updatePantryItem(existing.id, { qty: mergeQty(existing.qty, stockQty) });
    pantryUndo = () => { Store.updatePantryItem(existing.id, { qty: priorQty }); };
  } else {
    const stamp = (typeof ShelfLife !== 'undefined') ? ShelfLife.stampExpiry(item.name) : {};
    const added = Store.addPantryItem(Object.assign(
      { name: item.name, category: item.category || guessCategory(item.name), qty: stockQty },
      stamp
    ));
    pantryUndo = () => { Store.removePantryItem(added.id); };
  }

  // Remove from the shopping list.
  Store.removeItem(id);
  items = Store.getItems();
  pantryItems = Store.getPantry();
  renderList(); renderPantry(); updateSyncStatus();

  toastAction(I18n.t('toast.movedPantry', { name: item.name }), I18n.t('action.undo'), () => {
    // Reverse: undo the pantry change, then restore the list item as it was.
    try { pantryUndo(); } catch (e) {}
    Store.addItem(snapshot);
    items = Store.getItems();
    pantryItems = Store.getPantry();
    renderList(); renderPantry(); updateSyncStatus();
    toast(I18n.t('toast.restored', { name: item.name }));
  });
}

// Merge two free-text quantities. Pure numbers add (2 + 3 → "5"); otherwise we
// keep it human and concatenate ("1 bag" + "2" → "1 bag + 2"). Best-effort: qty
// is a free-text field, so we don't try to be clever about units.
function mergeQty(a, b) {
  a = (a || '').trim(); b = (b || '').trim();
  if (!a) return b;
  if (!b) return a;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb) && String(na) === a && String(nb) === b) return String(na + nb);
  return `${a} + ${b}`;
}

function removeItem(id) {
  Store.removeItem(id);
  items = Store.getItems();
  renderList(); updateSyncStatus();
}

function updateQty(id, qty) {
  Store.updateItem(id, { qty });
  items = Store.getItems();
  updateSyncStatus();
}

function clearChecked() {
  const checkedCount = items.filter(i => i.checked).length;
  if (!checkedCount) return;
  if (!confirm(I18n.t('confirm.removeChecked', { count: checkedCount }))) return;
  const n = Store.clearChecked();
  items = Store.getItems();
  renderList(); updateSyncStatus(); toast(I18n.t('toast.cleared', { count: n }));
}

function renderList() {
  const container = document.getElementById('list-container');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('item-count');
  const unc = items.filter(i => !i.checked).length;
  count.textContent = I18n.itemCountWithDone(unc, items.length - unc);
  if (!items.length) { container.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');
  const sorted = viewMode === 'category' ? sortByCategory(items) : sortFlat(items);
  container.innerHTML = sorted; bindItemEvents(container);
}

function sortFlat(list) {
  return [...list].sort((a,b) => a.checked!==b.checked?(a.checked?1:-1):0).map(renderItem).join('');
}

function sortByCategory(list) {
  const g = {}; list.forEach(i => { const c = i.category||'other'; (g[c]=g[c]||[]).push(i); });
  return Object.keys(g).sort((a,b)=>(CAT_INFO[a]?.order||99)-(CAT_INFO[b]?.order||99))
    .map(c => {
      const info = CAT_INFO[c]||{emoji:'📦',label:c};
      return `<div class="category-header">${info.emoji} ${catLabel(c)}</div>`
        + g[c].sort((a,b)=>a.checked?1:b.checked?-1:0).map(renderItem).join('');
    }).join('');
}

// Tracks row ids that have already played their one-time intro fade, so a
// re-render (sync poll, checkbox toggle, qty edit) doesn't replay it. A row
// animates the first time its id is rendered and never again. freshClass()
// returns ' fresh' exactly once per id, then marks it seen.
const _animatedIds = new Set();
function freshClass(id) {
  if (_animatedIds.has(id)) return '';
  _animatedIds.add(id);
  return ' fresh';
}

function renderItem(item) {
  const info = CAT_INFO[item.category]||{emoji:'📦'};
  const who = {jarvis:' 🏠',watson:' 🤖',recipe:' 🍳'}[item.added_by]||'';
  const inPantry = pantryItems.some(p => p.name.toLowerCase() === item.name.toLowerCase());
  const safeName = esc(item.name);
  // Swipe wrapper: a fixed "stock" action sits behind the row; the row slides
  // right to reveal it. The row keeps all its existing controls/refs.
  return `<div class="swipe-wrap" data-id="${item.id}">
    <div class="swipe-action swipe-action-stock" aria-hidden="true">🏪 ${I18n.t('swipe.stock')}</div>
    <div class="item swipe-item${freshClass(item.id)} ${item.checked?'checked':''}" data-id="${item.id}" data-name="${safeName}" data-category="${item.category||'other'}">
      <button type="button" class="item-checkbox" aria-pressed="${item.checked?'true':'false'}" aria-label="${I18n.t(item.checked?'aria.uncheck':'aria.check',{name:safeName})}">${item.checked?'✓':''}</button>
      <div class="item-content item-content-tappable" role="button" tabindex="0" aria-label="${I18n.t('aria.tapRecipes',{name:safeName})}">
        <div class="item-name">${safeName}${inPantry?` <span class="in-pantry">${I18n.t('badge.inPantry')}</span>`:''}</div>
        <div class="item-meta">${info.emoji}${who}</div>
      </div>
      <input type="text" class="item-qty" value="${esc(item.qty||'')}" placeholder="${I18n.t('form.qtyPlaceholder')}" data-id="${item.id}" aria-label="${I18n.t('aria.qtyFor',{name:safeName})}">
      <button class="item-delete" data-id="${item.id}" aria-label="${I18n.t('aria.remove',{name:safeName})}">✕</button>
    </div>
  </div>`;
}

function bindItemEvents(c) {
  c.querySelectorAll('.item-checkbox').forEach(cb => cb.addEventListener('click',()=>toggleItem(cb.closest('.item').dataset.id)));
  c.querySelectorAll('.item-delete').forEach(b => b.addEventListener('click',()=>removeItem(b.dataset.id)));
  c.querySelectorAll('.item-qty').forEach(inp => inp.addEventListener('change',()=>updateQty(inp.dataset.id,inp.value)));
  // Tap the name block → "what can I make with this?"
  c.querySelectorAll('.item-content-tappable').forEach(el => {
    const open = () => showRecipesUsing(el.closest('.item').dataset.name);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); open(); } });
  });
  // Swipe-right to stock. Pointer Events cover touch + mouse + pen uniformly.
  c.querySelectorAll('.swipe-item').forEach(bindSwipe);
}

// Swipe-right-to-stock. Drag the row rightward past a threshold → stockToPantry().
// Below threshold it snaps back. Horizontal-intent guard so vertical scrolling
// and qty-input focus aren't hijacked.
const SWIPE_THRESHOLD = 88;   // px of travel to trigger
const SWIPE_MAX = 120;        // visual cap on drag distance
function bindSwipe(row) {
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
  const wrap = row.closest('.swipe-wrap');

  const onDown = (e) => {
    // Ignore drags that begin on interactive controls (checkbox, qty, delete).
    if (e.target.closest('.item-checkbox, .item-qty, .item-delete')) return;
    startX = e.clientX; startY = e.clientY; dx = 0;
    dragging = true; decided = false; horizontal = false;
    row.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!decided) {
      // First meaningful movement decides intent: horizontal → swipe, vertical → let scroll happen.
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy);
        // Reveal the action layer only once we've committed to a horizontal swipe.
        if (horizontal) {
          if (wrap) wrap.classList.add('swiping');
          try { row.setPointerCapture(e.pointerId); } catch (_) {}
        }
      }
    }
    if (!horizontal) return;
    if (e.cancelable) e.preventDefault();
    // Direction-aware: LTR reveals the stock action by dragging the row toward the
    // INLINE-END (rightward, dir=+1); RTL mirrors it (leftward, dir=-1) so the
    // gesture matches where the "🏪 Stock" layer actually sits after RTL flip.
    const dir = (typeof I18n !== 'undefined' && I18n.isRtl()) ? -1 : 1;
    const travel = Math.max(0, Math.min(dx * dir, SWIPE_MAX)); // reveal distance, always ≥0
    row.style.transform = `translateX(${travel * dir}px)`;     // actual visual translate
    row.classList.toggle('swipe-armed', travel >= SWIPE_THRESHOLD);
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    row.style.transition = '';
    row.classList.remove('swipe-armed');
    if (wrap) wrap.classList.remove('swiping');
    const dir = (typeof I18n !== 'undefined' && I18n.isRtl()) ? -1 : 1;
    const fired = horizontal && dx * dir >= SWIPE_THRESHOLD;
    row.style.transform = '';
    try { row.releasePointerCapture(e.pointerId); } catch (_) {}
    if (fired) stockToPantry(row.dataset.id);
  };

  row.addEventListener('pointerdown', onDown);
  row.addEventListener('pointermove', onMove);
  row.addEventListener('pointerup', onUp);
  row.addEventListener('pointercancel', onUp);
}

// ===== RECIPES =====
function renderRecipesList() {
  const grid = document.getElementById('recipes-grid');
  const empty = document.getElementById('recipes-empty');
  const filtered = recipeFilter === 'all' ? recipes : recipes.filter(r => (r.tags||[]).includes(recipeFilter));
  if (!filtered.length) { grid.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');
  grid.innerHTML = filtered.map(r => {
    const nutr = r.nutrition && r.nutrition.cal ? r.nutrition : estimateNutrition(r.ingredients);
    const tags = (r.tags||[]).map(t => `<span class="recipe-tag">${t}</span>`).join('');
    return `<div class="recipe-preview" data-id="${r.id}">
      <div class="recipe-preview-title">${esc(r.name)}</div>
      <div class="recipe-preview-meta">
        <span>🍽️ ${r.servings||'?'}</span><span>⏱️ ${r.time||'?'}</span>
        <span>📝 ${(r.ingredients||[]).length}</span>
        ${nutr.cal?`<span>🔥 ${nutr.cal} cal</span>`:''}
      </div>
      ${tags?`<div class="recipe-tags">${tags}</div>`:''}
      <div class="recipe-preview-ingredients">${(r.ingredients||[]).slice(0,4).map(i=>i.name).join(', ')}${(r.ingredients||[]).length>4?'...':''}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.recipe-preview').forEach(el => el.addEventListener('click',()=>showRecipeDetail(el.dataset.id)));
}

function showRecipeDetail(id) {
  const r = recipes.find(x => x.id === id); if (!r) return;
  document.getElementById('recipes-list-view').style.display = 'none';
  document.getElementById('recipe-detail-view').style.display = 'block';
  const nutr = r.nutrition && r.nutrition.cal ? r.nutrition : estimateNutrition(r.ingredients);
  const card = document.getElementById('recipe-card');
  const ings = r.ingredients||[];
  const ingHtml = ings.map((ing,idx) => {
    const inList = items.some(i => i.name.toLowerCase()===ing.name.toLowerCase()&&!i.checked);
    const inPantry = pantryItems.some(p => p.name.toLowerCase()===ing.name.toLowerCase());
    return `<div class="ingredient-row">
      <span class="ing-text">${esc(ing.name)}${inPantry?` <span class="in-pantry">${I18n.t('recipe.inPantryTag')}</span>`:''}</span>
      <span class="ing-qty">${esc(ing.qty||'')}</span>
      <button class="ing-add-btn ${inList?'added':''}" data-idx="${idx}">${inList?I18n.t('recipe.added'):inPantry?I18n.t('recipe.haveIt'):I18n.t('recipe.addOne')}</button>
    </div>`;
  }).join('');
  const steps = (r.steps||[]).map(s=>`<li>${esc(s)}</li>`).join('');
  const tags = (r.tags||[]).map(t=>`<span class="recipe-tag">${t}</span>`).join('');

  card.innerHTML = `
    <div class="recipe-title">${esc(r.name)}</div>
    <div class="recipe-meta">
      <span>🍽️ ${r.servings||'?'}</span><span>⏱️ ${r.time||'?'}</span>
      ${r.cuisine?`<span>🌍 ${esc(r.cuisine)}</span>`:''}
    </div>
    ${tags?`<div class="recipe-tags" style="margin-bottom:12px">${tags}</div>`:''}
    ${r.source?`<a class="recipe-source-link" href="${esc(r.source)}" target="_blank">📎 ${esc(r.source_type||'Source')}</a>`:''}
    ${nutr.cal?`<div class="nutrition-card">
      <div class="nutrition-title">${I18n.t('nutr.title')}</div>
      <div class="nutrition-grid">
        <div class="nutr-item"><span class="nutr-val">${nutr.cal}</span><span class="nutr-label">${I18n.t('nutr.calories')}</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.protein}g</span><span class="nutr-label">${I18n.t('nutr.protein')}</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.carbs}g</span><span class="nutr-label">${I18n.t('nutr.carbs')}</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.fat}g</span><span class="nutr-label">${I18n.t('nutr.fat')}</span></div>
      </div>
    </div>`:''}
    <div class="recipe-section-title">${I18n.t('recipe.sectionIngredients')}</div>
    <button class="recipe-btn-add-all" id="add-all-btn">${I18n.t('recipe.addAll')}</button>
    ${ingHtml}
    ${steps?`<div class="recipe-section-title">${I18n.t('recipe.sectionInstructions')}</div><div class="recipe-instructions"><ol>${steps}</ol></div>`:''}
    <button class="cook-start-btn" data-id="${r.id}">${I18n.t('recipe.startCooking')}</button>
  `;

  card.querySelectorAll('.ing-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('added')) return;
      const ing = ings[parseInt(btn.dataset.idx)];
      await addItem(ing.name, null, ing.qty, 'recipe');
      btn.textContent = I18n.t('recipe.added'); btn.classList.add('added');
    });
  });
  document.getElementById('add-all-btn').addEventListener('click', async () => {
    let added = 0;
    for (const ing of ings) {
      const inList = items.some(i => i.name.toLowerCase()===ing.name.toLowerCase()&&!i.checked);
      const inPantry = pantryItems.some(p => p.name.toLowerCase()===ing.name.toLowerCase());
      if (!inList && !inPantry) { await addItem(ing.name, null, ing.qty, 'recipe'); added++; }
    }
    card.querySelectorAll('.ing-add-btn').forEach(b=>{b.textContent=I18n.t('recipe.added');b.classList.add('added');});
    toast(I18n.t('toast.addedMissing', { count: added }));
  });
  card.querySelector('.cook-start-btn')?.addEventListener('click', () => startCooking(id));
}

// ===== RECIPE CREATION =====
function showRecipeForm() {
  document.getElementById('recipes-list-view').style.display = 'none';
  document.getElementById('recipe-detail-view').style.display = 'none';
  document.getElementById('recipe-form-view').style.display = 'block';
  // reset fields
  ['rf-name','rf-servings','rf-time'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('rf-meal').value = '';
  document.getElementById('rf-ingredients').innerHTML = '';
  document.getElementById('rf-steps').innerHTML = '';
  addIngredientRow(); addIngredientRow();  // start with a couple of blank rows
  addStepRow();
}

function hideRecipeForm() {
  document.getElementById('recipe-form-view').style.display = 'none';
  document.getElementById('recipes-list-view').style.display = '';
}

function addIngredientRow(name, qty) {
  const wrap = document.getElementById('rf-ingredients');
  const row = document.createElement('div');
  row.className = 'form-ing-row';
  row.innerHTML = `
    <input type="text" class="field-input rf-ing-name" placeholder="${I18n.t('form.ingredientPlaceholder')}" value="${esc(name||'')}" autocomplete="off">
    <input type="text" class="field-input rf-ing-qty" placeholder="${I18n.t('form.qtyPlaceholder')}" value="${esc(qty||'')}" autocomplete="off">
    <button type="button" class="form-row-del" aria-label="${I18n.t('aria.removeIngredient')}">✕</button>`;
  row.querySelector('.form-row-del').addEventListener('click', () => row.remove());
  wrap.appendChild(row);
}

function addStepRow(text) {
  const wrap = document.getElementById('rf-steps');
  const n = wrap.children.length + 1;
  const row = document.createElement('div');
  row.className = 'form-step-row';
  row.innerHTML = `
    <span class="form-step-num">${n}</span>
    <textarea class="field-input rf-step-text" rows="2" placeholder="${I18n.t('form.stepPlaceholder')}">${esc(text||'')}</textarea>
    <button type="button" class="form-row-del" aria-label="${I18n.t('aria.removeStep')}">✕</button>`;
  row.querySelector('.form-row-del').addEventListener('click', () => { row.remove(); renumberSteps(); });
  wrap.appendChild(row);
}

function renumberSteps() {
  document.querySelectorAll('#rf-steps .form-step-num').forEach((el, i) => { el.textContent = i + 1; });
}

function saveRecipeForm() {
  const name = document.getElementById('rf-name').value.trim();
  if (!name) { toast(I18n.t('toast.needName')); return; }
  const meal = document.getElementById('rf-meal').value;
  const servings = document.getElementById('rf-servings').value.trim();
  const time = document.getElementById('rf-time').value.trim();
  const ingredients = [...document.querySelectorAll('#rf-ingredients .form-ing-row')]
    .map(r => ({
      name: r.querySelector('.rf-ing-name').value.trim(),
      qty: r.querySelector('.rf-ing-qty').value.trim(),
    }))
    .filter(i => i.name);
  const steps = [...document.querySelectorAll('#rf-steps .rf-step-text')]
    .map(t => t.value.trim()).filter(Boolean);

  Store.addRecipe({
    name, tags: meal ? [meal] : [],
    servings: servings || null, time: time || null,
    ingredients, steps, added_by: 'app',
  });
  recipes = Store.getRecipes();
  hideRecipeForm();
  renderRecipesList(); renderCookSelect(); updateSyncStatus();
  toast(I18n.t('toast.recipeSaved', { name }));
}

// ===== PANTRY =====
function addPantryItem(name) {
  if (!name.trim()) return;
  const clean = name.trim();
  const stamp = (typeof ShelfLife !== 'undefined') ? ShelfLife.stampExpiry(clean) : {};
  Store.addPantryItem(Object.assign({ name: clean, category: guessCategory(clean) }, stamp));
  pantryItems = Store.getPantry();
  renderPantry(); renderList(); updateSyncStatus(); toast(I18n.t('toast.addedToPantry', { name: clean }));
}

function removePantryItem(id) {
  Store.removePantryItem(id);
  pantryItems = Store.getPantry();
  renderPantry(); renderList(); updateSyncStatus();
}

// ----- Expiry editing (manual override) -----
// The date <input type="date"> speaks local YYYY-MM-DD; stored expiry is full ISO.
// We bridge the two by anchoring at LOCAL NOON, so the round-trip survives any
// timezone offset without an off-by-one-day shift (daysUntil floors to local
// midnight, and noon ± up-to-12h stays on the same calendar day).

// ISO timestamp → local "YYYY-MM-DD" suitable for a date input's value.
function isoToLocalDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Local "YYYY-MM-DD" from a date input → ISO timestamp anchored at local noon.
function localDateInputToIso(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0); // local noon
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

// Manually override a pantry item's expiry to a user-picked date.
function setPantryExpiry(id, dateStr) {
  const iso = localDateInputToIso(dateStr);
  if (!iso) { toast(I18n.t('toast.dateOff')); return; }
  const p = pantryItems.find(i => i.id === id);
  Store.updatePantryItem(id, { expires_at: iso });
  pantryItems = Store.getPantry();
  renderPantry(); updateSyncStatus();
  const st = expiryStatus({ expires_at: iso });
  toast(I18n.t('toast.expiryUpdated', { name: p ? p.name : I18n.t('misc.item'), label: st.label || I18n.t('misc.updated') }));
}

// Reset a pantry item's expiry back to the auto estimate (shelf-life from stock date).
function resetPantryExpiry(id, name) {
  const p = pantryItems.find(i => i.id === id);
  if (!p) return;
  // Re-estimate from the original stock date so "reset" means "as if just stocked then".
  const stamp = (typeof ShelfLife !== 'undefined')
    ? ShelfLife.stampExpiry(name || p.name, p.stocked_at)
    : {};
  if (!stamp.expires_at) { toast(I18n.t('toast.noEstimate')); return; }
  Store.updatePantryItem(id, { expires_at: stamp.expires_at, shelf_life_days: stamp.shelf_life_days });
  pantryItems = Store.getPantry();
  renderPantry(); updateSyncStatus();
  const st = expiryStatus({ expires_at: stamp.expires_at });
  toast(I18n.t('toast.expiryReset', { name: p.name, label: st.label || I18n.t('misc.updated') }));
}

// Days between today (local midnight) and an ISO date (YYYY-MM-DD). Negative = past.
function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
  if (isNaN(target)) return null;
  target.setHours(0,0,0,0);
  return Math.round((target - today) / 86400000);
}

// Expiry status for a pantry item → {cls, label, sort}. cls drives amber/red styling.
function expiryStatus(p) {
  const d = daysUntil(p.expires_at);
  if (d === null) return { cls:'', label:'', sort: 9e9 };
  const label = I18n.expiryLabel(d);
  const cls = d <= 0 ? 'expiry-bad' : (d <= 3 ? 'expiry-warn' : 'expiry-ok');
  return { cls, label, sort: d };
}

function renderPantry() {
  const container = document.getElementById('pantry-container');
  const empty = document.getElementById('pantry-empty');
  const count = document.getElementById('pantry-count');
  count.textContent = I18n.itemCount(pantryItems.length);
  if (!pantryItems.length) { container.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');
  // Most urgent (soonest/already expired) float to the top.
  const sorted = pantryItems.map(p => ({ p, st: expiryStatus(p) }))
                            .sort((a,b) => a.st.sort - b.st.sort);
  container.innerHTML = sorted.map(({p, st}) => {
    const info = CAT_INFO[p.category]||{emoji:'📦'};
    const qty = (p.qty && String(p.qty).trim()) ? `<span class="pantry-qty">×${esc(String(p.qty))}</span>` : '';
    const expiry = st.label ? `<span class="pantry-expiry ${st.cls}">${st.label}</span>` : '';
    return `<div class="item pantry-item${freshClass(p.id)} ${st.cls}" data-id="${p.id}" data-name="${esc(p.name)}" role="button" tabindex="0" aria-label="${I18n.t('aria.pantryRow',{name:esc(p.name),label:st.label||I18n.t('badge.inPantry')})}">
      <div class="item-content">
        <div class="item-name">${info.emoji} ${esc(p.name)} ${qty}</div>
        ${expiry}
      </div>
      <button class="item-delete" data-id="${p.id}" aria-label="${I18n.t('aria.removePantry',{name:esc(p.name)})}" title="${I18n.t('aria.removePantry',{name:esc(p.name)})}">✕</button>
    </div>`;
  }).join('');
  container.querySelectorAll('.item-delete').forEach(b => b.addEventListener('click',(e)=>{ e.stopPropagation(); removePantryItem(b.dataset.id); }));
  // Tap a pantry row → "what can I make with this?" + edit its expiry.
  container.querySelectorAll('.pantry-item').forEach(row => {
    const open = () => showRecipesUsing(row.dataset.name, row.dataset.id);
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); open(); } });
  });
}

// ===== MODAL + RECIPE CROSS-REFERENCE =====
let _modalKeyHandler = null;

function openModal(title, bodyHtml) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('show'));
  _modalKeyHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', _modalKeyHandler);
  return document.getElementById('modal-body');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('show');
  if (_modalKeyHandler) { document.removeEventListener('keydown', _modalKeyHandler); _modalKeyHandler = null; }
  setTimeout(() => { overlay.hidden = true; }, 180);
}

// Recipes that use a given ingredient name (case-insensitive substring, both directions).
function recipesUsing(name) {
  const q = (name||'').trim().toLowerCase();
  if (!q) return [];
  return recipes.filter(r => (r.ingredients||[]).some(ing => {
    const n = (ing.name||'').toLowerCase();
    return n === q || n.includes(q) || q.includes(n);
  }));
}

// Show the recipe cross-reference modal for an ingredient/product `name`.
// When `pantryId` is supplied (i.e. opened from a pantry row, not a list row),
// an expiry editor is prepended so the user can override the auto-estimated
// expiry date or reset it back to the estimate.
function showRecipesUsing(name, pantryId) {
  const matches = recipesUsing(name);
  let recipeHtml;
  if (!matches.length) {
    recipeHtml = `<p class="modal-empty">No recipes use <strong>${esc(name)}</strong> yet.</p>
            <p class="modal-hint">Add recipes in the Recipes tab — they'll show up here automatically.</p>`;
  } else {
    recipeHtml = `<p class="modal-sub">${matches.length} recipe${matches.length!==1?'s':''} use ${esc(name)}:</p>
      <div class="modal-recipe-list">` +
      matches.map(r => `
        <button class="modal-recipe-row" data-id="${r.id}">
          <span class="modal-recipe-name">${esc(r.name)}</span>
          <span class="modal-recipe-meta">${(r.ingredients||[]).length} ingr · ${(r.steps||[]).length} steps ›</span>
        </button>`).join('') +
      `</div>`;
  }
  const body = expiryEditorHtml(pantryId) + recipeHtml;
  const el = openModal(`🍳 Recipes with ${name}`, body);
  el.querySelectorAll('.modal-recipe-row').forEach(btn => {
    btn.addEventListener('click', () => { closeModal(); jumpToRecipe(btn.dataset.id); });
  });
  bindExpiryEditor(el, pantryId, name);
}

// HTML for the expiry-editor block shown at the top of the pantry modal.
// Returns '' when there's no pantry context (e.g. opened from a shopping-list row).
function expiryEditorHtml(pantryId) {
  if (!pantryId) return '';
  const p = pantryItems.find(i => i.id === pantryId);
  if (!p) return '';
  const st = expiryStatus(p);
  const statusLabel = st.label || 'no expiry set';
  // Pre-fill the date input with the current expiry as a local YYYY-MM-DD.
  const inputVal = isoToLocalDateInput(p.expires_at);
  return `<div class="expiry-editor">
      <div class="expiry-editor-head">
        <span class="expiry-editor-title">⏳ Expiry</span>
        <span class="pantry-expiry ${st.cls} expiry-editor-status">${esc(statusLabel)}</span>
      </div>
      <div class="expiry-editor-controls">
        <input type="date" class="expiry-date-input" value="${inputVal}" aria-label="${I18n.t('aria.pickExpiry',{name:esc(p.name)})}">
        <button class="expiry-save-btn" type="button">Save</button>
      </div>
      <button class="expiry-reset-btn" type="button">↺ Reset to estimate</button>
    </div>`;
}

function bindExpiryEditor(root, pantryId, name) {
  if (!pantryId) return;
  const input = root.querySelector('.expiry-date-input');
  const saveBtn = root.querySelector('.expiry-save-btn');
  const resetBtn = root.querySelector('.expiry-reset-btn');
  if (saveBtn && input) {
    saveBtn.addEventListener('click', () => {
      if (!input.value) { toast(I18n.t('toast.pickDate')); return; }
      setPantryExpiry(pantryId, input.value);
      closeModal();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => { resetPantryExpiry(pantryId, name); closeModal(); });
  }
}

// Switch to Recipes tab and open a recipe's detail view.
function jumpToRecipe(id) {
  document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const navRecipes = document.querySelector('.tab[data-tab="recipes"]');
  navRecipes.classList.add('active'); navRecipes.setAttribute('aria-selected','true');
  document.getElementById('tab-recipes').classList.add('active');
  showRecipeDetail(id);
}

// ===== GUIDED COOKING =====
let cookingRecipe = null, cookStep = 0, cookIngChecked = [];

function renderCookSelect() {
  const grid = document.getElementById('cook-recipes-grid');
  const empty = document.getElementById('cook-empty');
  if (!recipes.length) { grid.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');
  grid.innerHTML = recipes.map(r => `
    <div class="recipe-preview cook-recipe-card" data-id="${r.id}">
      <div class="recipe-preview-title">${esc(r.name)}</div>
      <div class="recipe-preview-meta"><span>⏱️ ${r.time||'?'}</span><span>📝 ${(r.steps||[]).length} steps</span></div>
    </div>
  `).join('');
  grid.querySelectorAll('.cook-recipe-card').forEach(el => el.addEventListener('click',()=>startCooking(el.dataset.id)));
}

function startCooking(id) {
  const r = recipes.find(x => x.id === id); if (!r) return;
  cookingRecipe = r; cookStep = 0;
  cookIngChecked = new Array((r.ingredients||[]).length).fill(false);

  // Switch to cook tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab[data-tab="cook"]').classList.add('active');
  document.getElementById('tab-cook').classList.add('active');

  document.getElementById('cook-select').style.display = 'none';
  document.getElementById('cook-mode').style.display = 'block';
  renderCookMode();
}

function renderCookMode() {
  const r = cookingRecipe; if (!r) return;
  const steps = r.steps || [];
  const ings = r.ingredients || [];
  const content = document.getElementById('cook-content');

  const ingHtml = ings.map((ing, idx) => `
    <div class="cook-ing ${cookIngChecked[idx]?'checked':''}" data-idx="${idx}">
      <div class="item-checkbox">${cookIngChecked[idx]?'✓':''}</div>
      <span>${esc(ing.qty||'')} ${esc(ing.name)}</span>
    </div>
  `).join('');

  const stepHtml = steps.length ? `
    <div class="cook-step-card">
      <div class="cook-step-num">${I18n.t('cook.step',{n:cookStep + 1,total:steps.length})}</div>
      <div class="cook-step-text">${esc(steps[cookStep])}</div>
      <div class="cook-step-nav">
        <button class="cook-nav-btn" id="cook-prev" ${cookStep===0?'disabled':''}>${I18n.t('cook.prevBtn')}</button>
        <button class="cook-nav-btn cook-nav-next" id="cook-next">${cookStep===steps.length-1?I18n.t('cook.done'):I18n.t('cook.next')}</button>
      </div>
    </div>
  ` : '';

  const progress = steps.length ? Math.round(((cookStep + 1) / steps.length) * 100) : 0;

  content.innerHTML = `
    <div class="cook-header">
      <h2>${esc(r.name)}</h2>
      <div class="cook-progress"><div class="cook-progress-bar" style="width:${progress}%"></div></div>
    </div>
    <div class="recipe-section-title">Ingredients — tick off as you prep</div>
    <div class="cook-ings">${ingHtml}</div>
    ${stepHtml}
  `;

  content.querySelectorAll('.cook-ing').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      cookIngChecked[idx] = !cookIngChecked[idx];
      renderCookMode();
    });
  });

  document.getElementById('cook-prev')?.addEventListener('click', () => { if (cookStep > 0) { cookStep--; renderCookMode(); } });
  document.getElementById('cook-next')?.addEventListener('click', () => {
    if (cookStep < steps.length - 1) { cookStep++; renderCookMode(); }
    else { toast(I18n.t('cook.complete')); exitCooking(); }
  });
}

function exitCooking() {
  cookingRecipe = null;
  document.getElementById('cook-select').style.display = '';
  document.getElementById('cook-mode').style.display = 'none';
}

// ===== HELPERS =====
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 2500);
}

// Toast with an action button (e.g. Undo). The action fires once; the toast
// dismisses on action or after `ms`. Returns nothing — fire and forget.
function toastAction(msg, actionLabel, onAction, ms = 5000) {
  const el = document.createElement('div');
  el.className = 'toast toast-action';
  const span = document.createElement('span'); span.textContent = msg;
  const btn = document.createElement('button');
  btn.className = 'toast-btn'; btn.type = 'button'; btn.textContent = actionLabel;
  let done = false;
  const close = () => { if (!el.parentNode) return; el.remove(); };
  btn.addEventListener('click', () => {
    if (done) return; done = true;
    try { onAction(); } finally { close(); }
  });
  el.appendChild(span); el.appendChild(btn);
  document.body.appendChild(el);
  setTimeout(close, ms);
}
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // i18n FIRST: detect language, set <html lang/dir>, fill static strings, so the
  // very first paint is already in the right language + direction (no flash of English).
  if (typeof I18n !== 'undefined') {
    I18n.init();
    applyStaticI18n();
    // On language change: re-fill static DOM, re-render all dynamic views, refresh
    // the theme button's aria (it's set imperatively, not via data-i18n).
    I18n.onChange(() => {
      applyStaticI18n();
      Theme.apply(Theme.resolve());
      updateLangButton();
      renderAll();
      updateSyncStatus();
    });
  }
  // Load the shelf-life map FIRST and await it, so the very first optimistic
  // pantry stamp has the correct expiry (no "wrong estimate flashes then
  // corrects on sync" race). It's a tiny static JSON; if it fails we fall back
  // to the in-module default and carry on.
  if (typeof ShelfLife !== 'undefined') { try { await ShelfLife.load(); } catch (e) {} }

  // Wire the offline-first store: localStorage truth, the VM API as best-effort sync.
  // Prefer LocalAPI (server.py); fall back to the legacy supabase global if present.
  // Repaint whenever the store changes (e.g. a background hydrate brings server data).
  Backend = (typeof LocalAPI !== 'undefined') ? LocalAPI
          : (typeof supabase !== 'undefined') ? supabase
          : null;
  Store.init(Backend, () => {
    items = Store.getItems();
    recipes = Store.getRecipes();
    pantryItems = Store.getPantry();
    renderAll();
    updateSyncStatus();
  });
  loadLocal();          // instant paint from local data
  syncData();           // quiet background sync (no error toast if offline)

  // Theme toggle (Theme.init already ran early; re-apply so the button icon is set)
  Theme.apply(Theme.resolve());
  document.getElementById('btn-theme').addEventListener('click', () => Theme.toggle());

  // Language toggle (EN/עב). Flips language + direction; I18n.onChange re-renders.
  updateLangButton();
  document.getElementById('btn-lang')?.addEventListener('click', () => {
    if (typeof I18n !== 'undefined') I18n.toggle();
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t=>{
        t.classList.remove('active');
        t.setAttribute('aria-selected','false');
      });
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    });
  });

  // Modal close wiring (close button + click on backdrop)
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Add item
  const input = document.getElementById('input-item');
  const catSel = document.getElementById('input-category');
  const doAdd = () => { addItem(input.value, catSel.value!=='auto'?catSel.value:null); input.value=''; catSel.value='auto'; input.focus(); };
  document.getElementById('btn-add').addEventListener('click', doAdd);
  input.addEventListener('keypress', e => { if (e.key==='Enter') doAdd(); });

  // Add pantry item
  const pInput = document.getElementById('input-pantry');
  const doAddPantry = () => { addPantryItem(pInput.value); pInput.value=''; pInput.focus(); };
  document.getElementById('btn-add-pantry').addEventListener('click', doAddPantry);
  pInput.addEventListener('keypress', e => { if (e.key==='Enter') doAddPantry(); });

  // Clear & sync. Sync buttons trigger a quiet background hydrate (no nagging toast).
  document.getElementById('btn-clear-done').addEventListener('click', clearChecked);
  document.getElementById('btn-sync').addEventListener('click', syncData);
  document.getElementById('btn-sync-recipes').addEventListener('click', syncData);
  document.getElementById('btn-sync-pantry').addEventListener('click', syncData);

  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.toggle-btn').forEach(b=>{
        const on = b===btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderList();
    });
  });

  // Recipe tag filter
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      recipeFilter = btn.dataset.tag;
      document.querySelectorAll('.tag-btn').forEach(b=>{
        const on = b===btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderRecipesList();
    });
  });

  // Recipe & cook back buttons
  document.getElementById('recipe-back').addEventListener('click', () => {
    document.getElementById('recipes-list-view').style.display = '';
    document.getElementById('recipe-detail-view').style.display = 'none';
  });
  document.getElementById('cook-back').addEventListener('click', exitCooking);

  // Recipe creation form
  document.getElementById('btn-new-recipe').addEventListener('click', showRecipeForm);
  document.getElementById('recipe-form-back').addEventListener('click', hideRecipeForm);
  document.getElementById('rf-add-ingredient').addEventListener('click', () => addIngredientRow());
  document.getElementById('rf-add-step').addEventListener('click', () => addStepRow());
  document.getElementById('rf-save').addEventListener('click', saveRecipeForm);

  // Background sync. The realtime subscription (if any) is opened lazily by
  // maybeSubscribeRealtime() only after a successful online sync. The interval is a
  // gentle best-effort retry that NEVER shows an error toast when offline (that was
  // the old 30s "Failed to load ❌" spam). 20s cadence so an agent-injected recipe
  // shows up within a few seconds of being written on the VM.
  setInterval(syncData, 20000);

  // Re-sync the moment the app regains focus / becomes visible. This is what makes
  // "Neo adds a recipe from YouTube → it's there when I open my phone" feel instant,
  // without a chatty short poll. Guarded so a hidden tab doesn't sync needlessly.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncData();
  });
  window.addEventListener('focus', syncData);
});
