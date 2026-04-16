// Shopping List App with Recipes
const CATEGORIES = {
  produce:'produce',dairy:'dairy',meat:'meat',bakery:'bakery',frozen:'frozen',
  drinks:'drinks',snacks:'snacks',pantry:'pantry',household:'household',personal:'personal',other:'other'
};

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

const AUTO_CATEGORY = {
  apple:'produce',banana:'produce',tomato:'produce',potato:'produce',
  onion:'produce',garlic:'produce',lemon:'produce',lime:'produce',
  avocado:'produce',cucumber:'produce',pepper:'produce',lettuce:'produce',
  carrot:'produce',broccoli:'produce',spinach:'produce',mushroom:'produce',
  orange:'produce',strawberry:'produce',grape:'produce',mango:'produce',
  ginger:'produce',cilantro:'produce',parsley:'produce',basil:'produce',
  corn:'produce',celery:'produce',zucchini:'produce',eggplant:'produce',
  milk:'dairy',cheese:'dairy',yogurt:'dairy',butter:'dairy',
  cream:'dairy',eggs:'dairy',egg:'dairy',cottage:'dairy',
  mozzarella:'dairy',cheddar:'dairy',parmesan:'dairy',
  chicken:'meat',beef:'meat',pork:'meat',fish:'meat',
  salmon:'meat',tuna:'meat',turkey:'meat',steak:'meat',
  shrimp:'meat',bacon:'meat',sausage:'meat',
  bread:'bakery',pita:'bakery',tortilla:'bakery',baguette:'bakery',
  challah:'bakery',bagel:'bakery',croissant:'bakery',
  'ice cream':'frozen',pizza:'frozen',
  water:'drinks',juice:'drinks',soda:'drinks',coffee:'drinks',
  tea:'drinks',beer:'drinks',wine:'drinks',
  chips:'snacks',crackers:'snacks',cookies:'snacks',chocolate:'snacks',
  nuts:'snacks',popcorn:'snacks',
  rice:'pantry',pasta:'pantry',flour:'pantry',sugar:'pantry',
  oil:'pantry',salt:'pantry',sauce:'pantry',beans:'pantry',
  cereal:'pantry',oats:'pantry',honey:'pantry',vinegar:'pantry',
  ketchup:'pantry',mustard:'pantry',mayo:'pantry',tahini:'pantry',hummus:'pantry',
  noodle:'pantry',lentil:'pantry',
  soap:'household',detergent:'household',sponge:'household',
  bleach:'household',cleaner:'household',foil:'household',
  shampoo:'personal',toothpaste:'personal',deodorant:'personal',
  'toilet paper':'personal',tissue:'personal',
};

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const [keyword, cat] of Object.entries(AUTO_CATEGORY)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'other';
}

// ===== STATE =====
let items = [];
let recipes = [];
let viewMode = 'list';
const STORAGE_KEY = 'shopping-list-v1';
const RECIPES_KEY = 'shopping-recipes-v1';

function load() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) items = JSON.parse(s);
  } catch(e) { items = []; }
  try {
    const r = localStorage.getItem(RECIPES_KEY);
    if (r) recipes = JSON.parse(r);
  } catch(e) { recipes = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  renderList();
}

function saveRecipes() {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
  renderRecipesList();
}

// ===== LIST FUNCTIONS =====
function addItem(name, category, qty, addedBy) {
  if (!name.trim()) return;
  const cat = category || guessCategory(name);
  items.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    name: name.trim(),
    category: cat,
    qty: qty || '',
    checked: false,
    addedAt: new Date().toISOString(),
    addedBy: addedBy || 'app',
  });
  save();
}

function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (item) { item.checked = !item.checked; save(); }
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  save();
}

function updateQty(id, qty) {
  const item = items.find(i => i.id === id);
  if (item) { item.qty = qty; save(); }
}

function clearChecked() {
  const count = items.filter(i => i.checked).length;
  if (count === 0) return;
  if (confirm(`Remove ${count} checked item${count>1?'s':''}?`)) {
    items = items.filter(i => !i.checked);
    save();
    toast(`Cleared ${count} item${count>1?'s':''}`);
  }
}

// ===== RENDER LIST =====
function renderList() {
  const container = document.getElementById('list-container');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('item-count');

  const unchecked = items.filter(i => !i.checked).length;
  const total = items.length;
  countEl.textContent = `${unchecked} item${unchecked!==1?'s':''}${total>unchecked?` (${total-unchecked} done)`:''}`;

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.classList.add('show');
    return;
  }
  emptyState.classList.remove('show');

  if (viewMode === 'category') {
    renderByCategory(container);
  } else {
    renderFlat(container);
  }
}

function renderFlat(container) {
  const sorted = [...items].sort((a,b) => a.checked !== b.checked ? (a.checked?1:-1) : 0);
  container.innerHTML = sorted.map(renderItem).join('');
  bindItemEvents(container);
}

function renderByCategory(container) {
  const groups = {};
  items.forEach(item => {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  const sortedCats = Object.keys(groups).sort((a,b) => (CAT_INFO[a]?.order||99)-(CAT_INFO[b]?.order||99));
  let html = '';
  sortedCats.forEach(cat => {
    const info = CAT_INFO[cat] || {emoji:'📦',label:cat};
    const catItems = groups[cat].sort((a,b) => a.checked?1:b.checked?-1:0);
    html += `<div class="category-header">${info.emoji} ${info.label}</div>`;
    html += catItems.map(renderItem).join('');
  });
  container.innerHTML = html;
  bindItemEvents(container);
}

function renderItem(item) {
  const catInfo = CAT_INFO[item.category] || {emoji:'📦'};
  return `<div class="item ${item.checked?'checked':''}" data-id="${item.id}">
    <div class="item-checkbox">${item.checked?'✓':''}</div>
    <div class="item-content">
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-meta">${catInfo.emoji}${item.addedBy==='watson'?' 🤖':item.addedBy==='recipe'?' 🍳':''}</div>
    </div>
    <input type="text" class="item-qty" value="${esc(item.qty||'')}" placeholder="qty" data-id="${item.id}">
    <button class="item-delete" data-id="${item.id}">✕</button>
  </div>`;
}

function bindItemEvents(container) {
  container.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('click', () => toggleItem(cb.closest('.item').dataset.id));
  });
  container.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.id));
  });
  container.querySelectorAll('.item-qty').forEach(input => {
    input.addEventListener('change', () => updateQty(input.dataset.id, input.value));
  });
}

// ===== RECIPES =====
function renderRecipesList() {
  const grid = document.getElementById('recipes-grid');
  const empty = document.getElementById('recipes-empty');

  if (recipes.length === 0) {
    grid.innerHTML = '';
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  grid.innerHTML = recipes.map(r => `
    <div class="recipe-preview" data-id="${r.id}">
      <div class="recipe-preview-title">${esc(r.name)}</div>
      <div class="recipe-preview-meta">
        <span>🍽️ ${r.servings||'?'} servings</span>
        <span>⏱️ ${r.time||'?'}</span>
        <span>📝 ${r.ingredients?.length||0} ingredients</span>
      </div>
      <div class="recipe-preview-ingredients">
        ${(r.ingredients||[]).slice(0,5).map(i=>i.name).join(', ')}${r.ingredients?.length>5?'...':''}
      </div>
      ${r.source?`<span class="recipe-source-badge">${esc(r.sourceType||'Link')}</span>`:''}
    </div>
  `).join('');

  grid.querySelectorAll('.recipe-preview').forEach(el => {
    el.addEventListener('click', () => showRecipeDetail(el.dataset.id));
  });
}

function showRecipeDetail(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;

  document.getElementById('recipes-list-view').style.display = 'none';
  document.getElementById('recipe-detail-view').style.display = 'block';

  const card = document.getElementById('recipe-card');
  const ingHtml = (recipe.ingredients||[]).map((ing, idx) => {
    const alreadyInList = items.some(i => i.name.toLowerCase() === ing.name.toLowerCase() && !i.checked);
    return `<div class="ingredient-row">
      <span class="ing-text">${esc(ing.name)}</span>
      <span class="ing-qty">${esc(ing.qty||'')}</span>
      <button class="ing-add-btn ${alreadyInList?'added':''}" data-recipe="${id}" data-idx="${idx}">
        ${alreadyInList?'✓ Added':'+ Add'}
      </button>
    </div>`;
  }).join('');

  const stepsHtml = (recipe.steps||[]).map((s,i) => `<li>${esc(s)}</li>`).join('');

  card.innerHTML = `
    <div class="recipe-title">${esc(recipe.name)}</div>
    <div class="recipe-meta">
      <span>🍽️ ${recipe.servings||'?'} servings</span>
      <span>⏱️ ${recipe.time||'?'}</span>
      ${recipe.cuisine?`<span>🌍 ${esc(recipe.cuisine)}</span>`:''}
    </div>
    ${recipe.source?`<a class="recipe-source-link" href="${esc(recipe.source)}" target="_blank">📎 ${esc(recipe.sourceType||'Source')}</a>`:''}
    ${recipe.notes?`<p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">${esc(recipe.notes)}</p>`:''}
    <div class="recipe-section-title">Ingredients</div>
    <button class="recipe-btn-add-all" data-recipe="${id}">🛒 Add All to Shopping List</button>
    ${ingHtml}
    ${stepsHtml?`<div class="recipe-section-title">Instructions</div><div class="recipe-instructions"><ol>${stepsHtml}</ol></div>`:''}
  `;

  // Bind add buttons
  card.querySelectorAll('.ing-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = recipes.find(x => x.id === btn.dataset.recipe);
      const ing = r.ingredients[parseInt(btn.dataset.idx)];
      if (!btn.classList.contains('added')) {
        addItem(ing.name, null, ing.qty, 'recipe');
        btn.textContent = '✓ Added';
        btn.classList.add('added');
        toast(`Added ${ing.name}`);
      }
    });
  });

  // Add all button
  card.querySelector('.recipe-btn-add-all').addEventListener('click', () => {
    let added = 0;
    (recipe.ingredients||[]).forEach(ing => {
      const exists = items.some(i => i.name.toLowerCase() === ing.name.toLowerCase() && !i.checked);
      if (!exists) {
        addItem(ing.name, null, ing.qty, 'recipe');
        added++;
      }
    });
    card.querySelectorAll('.ing-add-btn').forEach(b => { b.textContent='✓ Added'; b.classList.add('added'); });
    toast(`Added ${added} ingredient${added!==1?'s':''} to shopping list`);
  });
}

// ===== SYNC =====
async function syncFromFile() {
  try {
    const res = await fetch('shopping-list.json?t='+Date.now());
    if (!res.ok) throw new Error('No sync file');
    const data = await res.json();

    if (data.items && Array.isArray(data.items)) {
      let added = 0;
      data.items.forEach(wi => {
        const exists = items.find(i => i.id === wi.id || i.name.toLowerCase() === wi.name.toLowerCase());
        if (!exists) { items.push({...wi, addedBy: wi.addedBy||'watson'}); added++; }
      });
      if (data.removed && Array.isArray(data.removed)) {
        items = items.filter(i => !data.removed.includes(i.id) && !data.removed.includes(i.name.toLowerCase()));
      }
      save();
      if (added > 0) toast(`Synced ${added} item${added>1?'s':''} from Watson 🤖`);
    }

    // Sync recipes
    if (data.recipes && Array.isArray(data.recipes)) {
      let addedR = 0;
      data.recipes.forEach(wr => {
        const exists = recipes.find(r => r.id === wr.id || r.name.toLowerCase() === wr.name.toLowerCase());
        if (!exists) { recipes.push(wr); addedR++; }
      });
      if (addedR > 0) {
        saveRecipes();
        toast(`${addedR} new recipe${addedR>1?'s':''}! 🍳`);
      }
    }

    document.getElementById('sync-info').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
  } catch(e) {
    document.getElementById('sync-info').textContent = 'Sync: offline (using local data)';
  }
}

// ===== HELPERS =====
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  load();
  renderList();
  renderRecipesList();

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
  const addBtn = document.getElementById('btn-add');

  function doAdd() {
    const cat = catSelect.value !== 'other' ? catSelect.value : null;
    addItem(input.value, cat);
    input.value = '';
    catSelect.value = 'other';
    input.focus();
  }
  addBtn.addEventListener('click', doAdd);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') doAdd(); });

  // Clear checked
  document.getElementById('btn-clear-done').addEventListener('click', clearChecked);

  // Sync buttons
  document.getElementById('btn-sync').addEventListener('click', syncFromFile);
  document.getElementById('btn-sync-recipes').addEventListener('click', syncFromFile);

  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderList();
    });
  });

  // Recipe back button
  document.getElementById('recipe-back').addEventListener('click', () => {
    document.getElementById('recipes-list-view').style.display = '';
    document.getElementById('recipe-detail-view').style.display = 'none';
  });

  // Auto-sync
  syncFromFile();
  setInterval(syncFromFile, 30000);
});
