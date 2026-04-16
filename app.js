// Shopping List App
const CATEGORIES = {
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

// Auto-categorize common items
const AUTO_CATEGORY = {
  // Produce
  apple: 'produce', banana: 'produce', tomato: 'produce', potato: 'produce',
  onion: 'produce', garlic: 'produce', lemon: 'produce', lime: 'produce',
  avocado: 'produce', cucumber: 'produce', pepper: 'produce', lettuce: 'produce',
  carrot: 'produce', broccoli: 'produce', spinach: 'produce', mushroom: 'produce',
  orange: 'produce', strawberry: 'produce', grape: 'produce', mango: 'produce',
  ginger: 'produce', cilantro: 'produce', parsley: 'produce', basil: 'produce',
  corn: 'produce', celery: 'produce', zucchini: 'produce', eggplant: 'produce',
  // Dairy
  milk: 'dairy', cheese: 'dairy', yogurt: 'dairy', butter: 'dairy',
  cream: 'dairy', eggs: 'dairy', egg: 'dairy', cottage: 'dairy',
  mozzarella: 'dairy', cheddar: 'dairy', parmesan: 'dairy', sour: 'dairy',
  // Meat
  chicken: 'meat', beef: 'meat', pork: 'meat', fish: 'meat',
  salmon: 'meat', tuna: 'meat', turkey: 'meat', steak: 'meat',
  shrimp: 'meat', bacon: 'meat', sausage: 'meat', ground: 'meat',
  // Bakery
  bread: 'bakery', pita: 'bakery', tortilla: 'bakery', baguette: 'bakery',
  roll: 'bakery', croissant: 'bakery', bagel: 'bakery', muffin: 'bakery',
  challah: 'bakery',
  // Frozen
  'ice cream': 'frozen', frozen: 'frozen', pizza: 'frozen',
  // Drinks
  water: 'drinks', juice: 'drinks', soda: 'drinks', coffee: 'drinks',
  tea: 'drinks', beer: 'drinks', wine: 'drinks', cola: 'drinks',
  // Snacks
  chips: 'snacks', crackers: 'snacks', cookies: 'snacks', chocolate: 'snacks',
  nuts: 'snacks', popcorn: 'snacks', pretzels: 'snacks', candy: 'snacks',
  // Pantry
  rice: 'pantry', pasta: 'pantry', flour: 'pantry', sugar: 'pantry',
  oil: 'pantry', salt: 'pantry', sauce: 'pantry', can: 'pantry',
  beans: 'pantry', cereal: 'pantry', oats: 'pantry', honey: 'pantry',
  vinegar: 'pantry', spice: 'pantry', ketchup: 'pantry', mustard: 'pantry',
  mayo: 'pantry', soy: 'pantry', noodle: 'pantry', lentil: 'pantry',
  tahini: 'pantry', hummus: 'pantry',
  // Household
  soap: 'household', detergent: 'household', sponge: 'household',
  'trash bag': 'household', 'paper towel': 'household', foil: 'household',
  'plastic wrap': 'household', bleach: 'household', cleaner: 'household',
  // Personal
  shampoo: 'personal', toothpaste: 'personal', deodorant: 'personal',
  'toilet paper': 'personal', tissue: 'personal', lotion: 'personal',
  razor: 'personal', sunscreen: 'personal',
};

function guessCategory(name) {
  const lower = name.toLowerCase();
  for (const [keyword, cat] of Object.entries(AUTO_CATEGORY)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'other';
}

// State
let items = [];
let viewMode = 'list'; // 'list' or 'category'
const STORAGE_KEY = 'shopping-list-v1';
const DATA_URL = 'shopping-list.json'; // for sync with Watson

// Load from localStorage
function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) items = JSON.parse(saved);
  } catch (e) {
    items = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  render();
}

// Add item
function addItem(name, category, qty) {
  if (!name.trim()) return;
  const cat = category || guessCategory(name);
  items.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    category: cat,
    qty: qty || '',
    checked: false,
    addedAt: new Date().toISOString(),
    addedBy: 'app',
  });
  save();
}

function toggleItem(id) {
  const item = items.find(i => i.id === id);
  if (item) {
    item.checked = !item.checked;
    save();
  }
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  save();
}

function updateQty(id, qty) {
  const item = items.find(i => i.id === id);
  if (item) {
    item.qty = qty;
    save();
  }
}

function clearChecked() {
  const count = items.filter(i => i.checked).length;
  if (count === 0) return;
  if (confirm(`Remove ${count} checked item${count > 1 ? 's' : ''}?`)) {
    items = items.filter(i => !i.checked);
    save();
    toast(`Cleared ${count} item${count > 1 ? 's' : ''}`);
  }
}

// Render
function render() {
  const container = document.getElementById('list-container');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('item-count');

  const unchecked = items.filter(i => !i.checked).length;
  const total = items.length;
  countEl.textContent = `${unchecked} item${unchecked !== 1 ? 's' : ''}${total > unchecked ? ` (${total - unchecked} done)` : ''}`;

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
  // Unchecked first, then checked
  const sorted = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return 0;
  });
  container.innerHTML = sorted.map(renderItem).join('');
  bindItemEvents(container);
}

function renderByCategory(container) {
  // Group by category
  const groups = {};
  items.forEach(item => {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  // Sort categories
  const sortedCats = Object.keys(groups).sort((a, b) =>
    (CATEGORIES[a]?.order || 99) - (CATEGORIES[b]?.order || 99)
  );

  let html = '';
  sortedCats.forEach(cat => {
    const info = CATEGORIES[cat] || { emoji: '📦', label: cat };
    const catItems = groups[cat].sort((a, b) => a.checked ? 1 : b.checked ? -1 : 0);
    html += `<div class="category-header">${info.emoji} ${info.label}</div>`;
    html += catItems.map(renderItem).join('');
  });

  container.innerHTML = html;
  bindItemEvents(container);
}

function renderItem(item) {
  const catInfo = CATEGORIES[item.category] || { emoji: '📦' };
  return `<div class="item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
    <div class="item-checkbox">${item.checked ? '✓' : ''}</div>
    <div class="item-content">
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-meta">${catInfo.emoji} ${item.addedBy === 'watson' ? '🤖 Watson' : ''}</div>
    </div>
    <input type="text" class="item-qty" value="${escapeHtml(item.qty || '')}" placeholder="qty" data-id="${item.id}">
    <button class="item-delete" data-id="${item.id}">✕</button>
  </div>`;
}

function bindItemEvents(container) {
  container.querySelectorAll('.item-checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      const id = cb.closest('.item').dataset.id;
      toggleItem(id);
    });
  });

  container.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => removeItem(btn.dataset.id));
  });

  container.querySelectorAll('.item-qty').forEach(input => {
    input.addEventListener('change', () => updateQty(input.dataset.id, input.value));
  });
}

// Sync with Watson's data file
async function syncFromFile() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('No sync file');
    const data = await res.json();

    if (data.items && Array.isArray(data.items)) {
      // Merge: Watson's items that aren't already in our list
      let added = 0;
      data.items.forEach(wi => {
        const exists = items.find(i => i.id === wi.id || i.name.toLowerCase() === wi.name.toLowerCase());
        if (!exists) {
          items.push({ ...wi, addedBy: wi.addedBy || 'watson' });
          added++;
        }
      });

      // Also sync removals: if Watson removed items, remove them locally too
      if (data.removed && Array.isArray(data.removed)) {
        items = items.filter(i => !data.removed.includes(i.id) && !data.removed.includes(i.name.toLowerCase()));
      }

      save();
      if (added > 0) toast(`Synced ${added} new item${added > 1 ? 's' : ''} from Watson 🤖`);
      document.getElementById('sync-info').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;
    }
  } catch (e) {
    // No sync file available — that's fine
    document.getElementById('sync-info').textContent = 'Sync: offline (using local data)';
  }
}

// Toast
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  load();
  render();

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

  // Sync
  document.getElementById('btn-sync').addEventListener('click', syncFromFile);

  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
  });

  // Auto-sync on load
  syncFromFile();

  // Periodic sync every 30 seconds
  setInterval(syncFromFile, 30000);
});
