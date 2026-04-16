// Shopping List App - Supabase Edition
const CAT_INFO = {
  produce:   { emoji: '🥬', label: 'Produce', order: 1 },
  dairy:     { emoji: '🧀', label: 'Dairy', order: 2 },
  meat:      { emoji: '🥩', label: 'Meat & Fish', order: 3 },
  bakery:    { emoji: '🍞', label: 'Bakery', order: 4 },
  frozen:    { emoji: '🧊', label: 'Frozen', order: 5 },
  drinks:    { emoji: '🥤', label: 'Drinks', order: 6 },
  snacks:    { emoji: '🍿', label: 'Snacks', order: 7 },
  pantry:    { emoji: '🥫', label: 'Pantry', order: 8 },
  household: { emoji: '🧹', label: 'Household', order: 9 },
  personal:  { emoji: '🧴', label: 'Personal Care', order: 10 },
  other:     { emoji: '📦', label: 'Other', order: 11 },
};

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

function guessCategory(name) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(AUTO_CAT)) { if (l.includes(k)) return v; }
  return 'other';
}

// State
let items = [];
let recipes = [];
let viewMode = 'list';
let loading = true;

// ===== DATA OPERATIONS =====
async function loadData() {
  loading = true;
  try {
    [items, recipes] = await Promise.all([supabase.getItems(), supabase.getRecipes()]);
  } catch (e) {
    console.error('Load error:', e);
    toast('Failed to load data ❌');
  }
  loading = false;
  renderList();
  renderRecipesList();
}

async function addItem(name, category, qty, addedBy) {
  if (!name.trim()) return;
  let parsedName = name.trim();
  let parsedQty = qty || '';

  // Parse quantity from item name: "3 apples", "2x milk", "milk x2", "dozen eggs"
  if (!parsedQty) {
    const patterns = [
      /^(\d+(?:\.\d+)?)\s*[xX]\s+(.+)$/,   // "3x apples" or "3 x apples"
      /^(\d+(?:\.\d+)?)\s+(.+)$/,             // "3 apples"
      /^(.+?)\s*[xX](\d+(?:\.\d+)?)$/,        // "apples x3"
      /^(a\s+)?dozen\s+(.+)$/i,               // "a dozen eggs" or "dozen eggs"
      /^(half\s+)?(?:a\s+)?kilo?\s+(?:of\s+)?(.+)$/i, // "a kilo of chicken"
    ];
    let m;
    if ((m = parsedName.match(patterns[0]))) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(patterns[1])) && !isNaN(m[1])) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(patterns[2]))) { parsedQty = m[2]; parsedName = m[1].trim(); }
    else if ((m = parsedName.match(patterns[3]))) { parsedQty = '12'; parsedName = m[2]; }
    else if ((m = parsedName.match(patterns[4]))) { parsedQty = m[1] ? '0.5 kg' : '1 kg'; parsedName = m[2]; }
  }

  try {
    const res = await supabase.addItem({
      name: parsedName,
      category: category || guessCategory(parsedName),
      qty: parsedQty,
      added_by: addedBy || 'app',
    });
    if (res && res[0]) items.push(res[0]);
    renderList();
    toast(`Added ${parsedName} ✅`);
  } catch (e) {
    console.error('Add error:', e);
    toast('Failed to add item ❌');
  }
}

async function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  renderList();
  try {
    await supabase.updateItem(id, { checked: item.checked });
  } catch (e) {
    item.checked = !item.checked;
    renderList();
    toast('Sync failed ❌');
  }
}

async function removeItem(id) {
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return;
  const removed = items.splice(idx, 1)[0];
  renderList();
  try {
    await supabase.deleteItem(id);
  } catch (e) {
    items.splice(idx, 0, removed);
    renderList();
    toast('Delete failed ❌');
  }
}

async function updateQty(id, qty) {
  const item = items.find(i => i.id === id);
  if (item) {
    item.qty = qty;
    try { await supabase.updateItem(id, { qty }); } catch (e) {}
  }
}

async function clearChecked() {
  const checked = items.filter(i => i.checked);
  if (!checked.length) return;
  if (!confirm(`Remove ${checked.length} checked item${checked.length > 1 ? 's' : ''}?`)) return;
  for (const item of checked) {
    try { await supabase.deleteItem(item.id); } catch (e) {}
  }
  items = items.filter(i => !i.checked);
  renderList();
  toast(`Cleared ${checked.length} item${checked.length > 1 ? 's' : ''}`);
}

// ===== RENDER LIST =====
function renderList() {
  const container = document.getElementById('list-container');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('item-count');

  if (loading) { countEl.textContent = 'Loading...'; return; }

  const unchecked = items.filter(i => !i.checked).length;
  const total = items.length;
  countEl.textContent = `${unchecked} item${unchecked !== 1 ? 's' : ''}${total > unchecked ? ` (${total - unchecked} done)` : ''}`;

  if (!items.length) {
    container.innerHTML = '';
    emptyState.classList.add('show');
    return;
  }
  emptyState.classList.remove('show');

  if (viewMode === 'category') renderByCategory(container);
  else renderFlat(container);
}

function renderFlat(container) {
  const sorted = [...items].sort((a, b) => a.checked !== b.checked ? (a.checked ? 1 : -1) : 0);
  container.innerHTML = sorted.map(renderItem).join('');
  bindItemEvents(container);
}

function renderByCategory(container) {
  const groups = {};
  items.forEach(i => { const c = i.category || 'other'; (groups[c] = groups[c] || []).push(i); });
  const cats = Object.keys(groups).sort((a, b) => (CAT_INFO[a]?.order || 99) - (CAT_INFO[b]?.order || 99));
  let html = '';
  cats.forEach(c => {
    const info = CAT_INFO[c] || { emoji: '📦', label: c };
    html += `<div class="category-header">${info.emoji} ${info.label}</div>`;
    html += groups[c].sort((a, b) => a.checked ? 1 : b.checked ? -1 : 0).map(renderItem).join('');
  });
  container.innerHTML = html;
  bindItemEvents(container);
}

function renderItem(item) {
  const info = CAT_INFO[item.category] || { emoji: '📦' };
  const who = item.added_by === 'jarvis' ? ' 🏠' : item.added_by === 'watson' ? ' 🤖' : item.added_by === 'recipe' ? ' 🍳' : '';
  return `<div class="item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
    <div class="item-checkbox">${item.checked ? '✓' : ''}</div>
    <div class="item-content">
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-meta">${info.emoji}${who}</div>
    </div>
    <input type="text" class="item-qty" value="${esc(item.qty || '')}" placeholder="qty" data-id="${item.id}">
    <button class="item-delete" data-id="${item.id}">✕</button>
  </div>`;
}

function bindItemEvents(container) {
  container.querySelectorAll('.item-checkbox').forEach(cb =>
    cb.addEventListener('click', () => toggleItem(cb.closest('.item').dataset.id)));
  container.querySelectorAll('.item-delete').forEach(btn =>
    btn.addEventListener('click', () => removeItem(btn.dataset.id)));
  container.querySelectorAll('.item-qty').forEach(input =>
    input.addEventListener('change', () => updateQty(input.dataset.id, input.value)));
}

// ===== RECIPES =====
function renderRecipesList() {
  const grid = document.getElementById('recipes-grid');
  const empty = document.getElementById('recipes-empty');

  if (!recipes.length) { grid.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');

  grid.innerHTML = recipes.map(r => `
    <div class="recipe-preview" data-id="${r.id}">
      <div class="recipe-preview-title">${esc(r.name)}</div>
      <div class="recipe-preview-meta">
        <span>🍽️ ${r.servings || '?'} servings</span>
        <span>⏱️ ${r.time || '?'}</span>
        <span>📝 ${(r.ingredients || []).length} ingredients</span>
      </div>
      <div class="recipe-preview-ingredients">
        ${(r.ingredients || []).slice(0, 5).map(i => i.name).join(', ')}${(r.ingredients || []).length > 5 ? '...' : ''}
      </div>
      ${r.source ? `<span class="recipe-source-badge">${esc(r.source_type || 'Link')}</span>` : ''}
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-preview').forEach(el =>
    el.addEventListener('click', () => showRecipeDetail(el.dataset.id)));
}

function showRecipeDetail(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  document.getElementById('recipes-list-view').style.display = 'none';
  document.getElementById('recipe-detail-view').style.display = 'block';

  const card = document.getElementById('recipe-card');
  const ings = recipe.ingredients || [];
  const ingHtml = ings.map((ing, idx) => {
    const inList = items.some(i => i.name.toLowerCase() === ing.name.toLowerCase() && !i.checked);
    return `<div class="ingredient-row">
      <span class="ing-text">${esc(ing.name)}</span>
      <span class="ing-qty">${esc(ing.qty || '')}</span>
      <button class="ing-add-btn ${inList ? 'added' : ''}" data-idx="${idx}">${inList ? '✓ Added' : '+ Add'}</button>
    </div>`;
  }).join('');

  const stepsHtml = (recipe.steps || []).map(s => `<li>${esc(s)}</li>`).join('');

  card.innerHTML = `
    <div class="recipe-title">${esc(recipe.name)}</div>
    <div class="recipe-meta">
      <span>🍽️ ${recipe.servings || '?'}</span>
      <span>⏱️ ${recipe.time || '?'}</span>
      ${recipe.cuisine ? `<span>🌍 ${esc(recipe.cuisine)}</span>` : ''}
    </div>
    ${recipe.source ? `<a class="recipe-source-link" href="${esc(recipe.source)}" target="_blank">📎 ${esc(recipe.source_type || 'Source')}</a>` : ''}
    <div class="recipe-section-title">Ingredients</div>
    <button class="recipe-btn-add-all" id="add-all-btn">🛒 Add All to Shopping List</button>
    ${ingHtml}
    ${stepsHtml ? `<div class="recipe-section-title">Instructions</div><div class="recipe-instructions"><ol>${stepsHtml}</ol></div>` : ''}
  `;

  card.querySelectorAll('.ing-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('added')) return;
      const ing = ings[parseInt(btn.dataset.idx)];
      await addItem(ing.name, null, ing.qty, 'recipe');
      btn.textContent = '✓ Added';
      btn.classList.add('added');
    });
  });

  document.getElementById('add-all-btn').addEventListener('click', async () => {
    let added = 0;
    for (const ing of ings) {
      if (!items.some(i => i.name.toLowerCase() === ing.name.toLowerCase() && !i.checked)) {
        await addItem(ing.name, null, ing.qty, 'recipe');
        added++;
      }
    }
    card.querySelectorAll('.ing-add-btn').forEach(b => { b.textContent = '✓ Added'; b.classList.add('added'); });
    toast(`Added ${added} ingredient${added !== 1 ? 's' : ''}`);
  });
}

// ===== HELPERS =====
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Add item
  const input = document.getElementById('input-item');
  const catSelect = document.getElementById('input-category');
  document.getElementById('btn-add').addEventListener('click', () => {
    addItem(input.value, catSelect.value !== 'other' ? catSelect.value : null);
    input.value = '';
    catSelect.value = 'other';
    input.focus();
  });
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      addItem(input.value, catSelect.value !== 'other' ? catSelect.value : null);
      input.value = '';
      catSelect.value = 'other';
    }
  });

  // Clear & refresh
  document.getElementById('btn-clear-done').addEventListener('click', clearChecked);
  document.getElementById('btn-sync').addEventListener('click', loadData);
  document.getElementById('btn-sync-recipes').addEventListener('click', loadData);

  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderList();
    });
  });

  // Recipe back
  document.getElementById('recipe-back').addEventListener('click', () => {
    document.getElementById('recipes-list-view').style.display = '';
    document.getElementById('recipe-detail-view').style.display = 'none';
  });

  // Realtime subscription
  try {
    supabase.subscribeToItems(() => loadData());
  } catch (e) {
    // Fallback: poll every 15 seconds
    setInterval(loadData, 15000);
  }

  // Also poll as backup
  setInterval(loadData, 30000);
});
