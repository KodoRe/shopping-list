// Home Kitchen App - Full Featured
const CAT_INFO = {
  produce:{emoji:'🥬',label:'Produce',order:1},dairy:{emoji:'🧀',label:'Dairy',order:2},
  meat:{emoji:'🥩',label:'Meat & Fish',order:3},bakery:{emoji:'🍞',label:'Bakery',order:4},
  frozen:{emoji:'🧊',label:'Frozen',order:5},drinks:{emoji:'🥤',label:'Drinks',order:6},
  snacks:{emoji:'🍿',label:'Snacks',order:7},pantry:{emoji:'🥫',label:'Pantry',order:8},
  household:{emoji:'🧹',label:'Household',order:9},personal:{emoji:'🧴',label:'Personal Care',order:10},
  other:{emoji:'📦',label:'Other',order:11},
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

// ===== DATA =====
async function loadData() {
  try {
    const [i, r] = await Promise.all([supabase.getItems(), supabase.getRecipes()]);
    items = i || []; recipes = r || [];
    try { pantryItems = await supabase.getPantry() || []; } catch(e) { pantryItems = []; }
  } catch(e) { console.error('Load error:', e); toast('Failed to load ❌'); }
  renderAll();
}

function renderAll() { renderList(); renderRecipesList(); renderPantry(); renderCookSelect(); }

// ===== SHOPPING LIST =====
async function addItem(name, category, qty, addedBy) {
  if (!name.trim()) return;
  let parsedName = name.trim(), parsedQty = qty || '';
  if (!parsedQty) {
    let m;
    if ((m = parsedName.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(.+)$/))) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)) && !isNaN(m[1])) { parsedQty = m[1]; parsedName = m[2]; }
    else if ((m = parsedName.match(/^(.+?)\s*[xX](\d+(?:\.\d+)?)$/))) { parsedQty = m[2]; parsedName = m[1].trim(); }
    else if ((m = parsedName.match(/^(?:a\s+)?dozen\s+(.+)$/i))) { parsedQty = '12'; parsedName = m[1]; }
  }
  try {
    const res = await supabase.addItem({
      name: parsedName, category: category || guessCategory(parsedName),
      qty: parsedQty, added_by: addedBy || 'app',
    });
    if (res?.[0]) items.push(res[0]);
    renderList(); toast(`Added ${parsedName} ✅`);
  } catch(e) { toast('Failed to add ❌'); }
}

async function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.checked = !item.checked; renderList();
  try { await supabase.updateItem(id, { checked: item.checked }); }
  catch(e) { item.checked = !item.checked; renderList(); }
}

async function removeItem(id) {
  const idx = items.findIndex(i => i.id === id);
  if (idx < 0) return;
  const rm = items.splice(idx, 1)[0]; renderList();
  try { await supabase.deleteItem(id); } catch(e) { items.splice(idx, 0, rm); renderList(); }
}

async function updateQty(id, qty) {
  const item = items.find(i => i.id === id);
  if (item) { item.qty = qty; try { await supabase.updateItem(id, { qty }); } catch(e) {} }
}

async function clearChecked() {
  const checked = items.filter(i => i.checked);
  if (!checked.length) return;
  if (!confirm(`Remove ${checked.length} checked?`)) return;
  for (const item of checked) { try { await supabase.deleteItem(item.id); } catch(e) {} }
  items = items.filter(i => !i.checked); renderList();
  toast(`Cleared ${checked.length} items`);
}

function renderList() {
  const container = document.getElementById('list-container');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('item-count');
  const unc = items.filter(i => !i.checked).length;
  count.textContent = `${unc} item${unc!==1?'s':''}${items.length>unc?` (${items.length-unc} done)`:''}`;
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
      return `<div class="category-header">${info.emoji} ${info.label}</div>`
        + g[c].sort((a,b)=>a.checked?1:b.checked?-1:0).map(renderItem).join('');
    }).join('');
}

function renderItem(item) {
  const info = CAT_INFO[item.category]||{emoji:'📦'};
  const who = {jarvis:' 🏠',watson:' 🤖',recipe:' 🍳'}[item.added_by]||'';
  const inPantry = pantryItems.some(p => p.name.toLowerCase() === item.name.toLowerCase());
  return `<div class="item ${item.checked?'checked':''}" data-id="${item.id}">
    <div class="item-checkbox">${item.checked?'✓':''}</div>
    <div class="item-content">
      <div class="item-name">${esc(item.name)}${inPantry?' <span class="in-pantry">in pantry</span>':''}</div>
      <div class="item-meta">${info.emoji}${who}</div>
    </div>
    <input type="text" class="item-qty" value="${esc(item.qty||'')}" placeholder="qty" data-id="${item.id}">
    <button class="item-delete" data-id="${item.id}">✕</button>
  </div>`;
}

function bindItemEvents(c) {
  c.querySelectorAll('.item-checkbox').forEach(cb => cb.addEventListener('click',()=>toggleItem(cb.closest('.item').dataset.id)));
  c.querySelectorAll('.item-delete').forEach(b => b.addEventListener('click',()=>removeItem(b.dataset.id)));
  c.querySelectorAll('.item-qty').forEach(inp => inp.addEventListener('change',()=>updateQty(inp.dataset.id,inp.value)));
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
      <span class="ing-text">${esc(ing.name)}${inPantry?' <span class="in-pantry">✓ pantry</span>':''}</span>
      <span class="ing-qty">${esc(ing.qty||'')}</span>
      <button class="ing-add-btn ${inList?'added':''}" data-idx="${idx}">${inList?'✓ Added':inPantry?'Have it':'+ Add'}</button>
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
      <div class="nutrition-title">Nutritional Estimate (total)</div>
      <div class="nutrition-grid">
        <div class="nutr-item"><span class="nutr-val">${nutr.cal}</span><span class="nutr-label">Calories</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.protein}g</span><span class="nutr-label">Protein</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.carbs}g</span><span class="nutr-label">Carbs</span></div>
        <div class="nutr-item"><span class="nutr-val">${nutr.fat}g</span><span class="nutr-label">Fat</span></div>
      </div>
    </div>`:''}
    <div class="recipe-section-title">Ingredients</div>
    <button class="recipe-btn-add-all" id="add-all-btn">🛒 Add Missing to List</button>
    ${ingHtml}
    ${steps?`<div class="recipe-section-title">Instructions</div><div class="recipe-instructions"><ol>${steps}</ol></div>`:''}
    <button class="cook-start-btn" data-id="${r.id}">👨‍🍳 Start Cooking</button>
  `;

  card.querySelectorAll('.ing-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('added')) return;
      const ing = ings[parseInt(btn.dataset.idx)];
      await addItem(ing.name, null, ing.qty, 'recipe');
      btn.textContent = '✓ Added'; btn.classList.add('added');
    });
  });
  document.getElementById('add-all-btn').addEventListener('click', async () => {
    let added = 0;
    for (const ing of ings) {
      const inList = items.some(i => i.name.toLowerCase()===ing.name.toLowerCase()&&!i.checked);
      const inPantry = pantryItems.some(p => p.name.toLowerCase()===ing.name.toLowerCase());
      if (!inList && !inPantry) { await addItem(ing.name, null, ing.qty, 'recipe'); added++; }
    }
    card.querySelectorAll('.ing-add-btn').forEach(b=>{b.textContent='✓ Added';b.classList.add('added');});
    toast(`Added ${added} items (skipped pantry items)`);
  });
  card.querySelector('.cook-start-btn')?.addEventListener('click', () => startCooking(id));
}

// ===== PANTRY =====
async function addPantryItem(name) {
  if (!name.trim()) return;
  try {
    const res = await supabase.addPantryItem({ name: name.trim(), category: guessCategory(name) });
    if (res?.[0]) pantryItems.push(res[0]);
    renderPantry(); renderList(); toast(`${name.trim()} added to pantry 🏪`);
  } catch(e) { toast('Failed ❌'); }
}

async function removePantryItem(id) {
  const idx = pantryItems.findIndex(i => i.id === id);
  if (idx < 0) return;
  pantryItems.splice(idx, 1); renderPantry();
  try { await supabase.deletePantryItem(id); } catch(e) {}
}

function renderPantry() {
  const container = document.getElementById('pantry-container');
  const empty = document.getElementById('pantry-empty');
  const count = document.getElementById('pantry-count');
  count.textContent = `${pantryItems.length} item${pantryItems.length!==1?'s':''}`;
  if (!pantryItems.length) { container.innerHTML = ''; empty.classList.add('show'); return; }
  empty.classList.remove('show');
  container.innerHTML = pantryItems.map(p => {
    const info = CAT_INFO[p.category]||{emoji:'📦'};
    return `<div class="item" data-id="${p.id}">
      <div class="item-content"><div class="item-name">${info.emoji} ${esc(p.name)}</div></div>
      <button class="item-delete" data-id="${p.id}">✕</button>
    </div>`;
  }).join('');
  container.querySelectorAll('.item-delete').forEach(b => b.addEventListener('click',()=>removePantryItem(b.dataset.id)));
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
      <div class="cook-step-num">Step ${cookStep + 1} of ${steps.length}</div>
      <div class="cook-step-text">${esc(steps[cookStep])}</div>
      <div class="cook-step-nav">
        <button class="cook-nav-btn" id="cook-prev" ${cookStep===0?'disabled':''}>← Previous</button>
        <button class="cook-nav-btn cook-nav-next" id="cook-next">${cookStep===steps.length-1?'🎉 Done!':'Next →'}</button>
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
    else { toast('🎉 Recipe complete! Enjoy your meal!'); exitCooking(); }
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
function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).classList.add('active');
    });
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

  // Clear & sync
  document.getElementById('btn-clear-done').addEventListener('click', clearChecked);
  document.getElementById('btn-sync').addEventListener('click', loadData);
  document.getElementById('btn-sync-recipes').addEventListener('click', loadData);
  document.getElementById('btn-sync-pantry').addEventListener('click', loadData);

  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.toggle-btn').forEach(b=>b.classList.toggle('active', b===btn));
      renderList();
    });
  });

  // Recipe tag filter
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      recipeFilter = btn.dataset.tag;
      document.querySelectorAll('.tag-btn').forEach(b=>b.classList.toggle('active', b===btn));
      renderRecipesList();
    });
  });

  // Recipe & cook back buttons
  document.getElementById('recipe-back').addEventListener('click', () => {
    document.getElementById('recipes-list-view').style.display = '';
    document.getElementById('recipe-detail-view').style.display = 'none';
  });
  document.getElementById('cook-back').addEventListener('click', exitCooking);

  // Realtime + polling
  try { supabase.subscribeToItems(()=>loadData()); } catch(e) {}
  setInterval(loadData, 30000);
});
