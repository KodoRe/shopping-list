// test-store.js — unit tests for the offline-first data layer.
// Run: node js/test-store.js   (exit 0 = all pass)
// No framework; plain assertions so it runs anywhere node does.

const assert = require('assert');
const Store = require('./store.js');

let pass = 0;
function ok(label, cond) {
  assert.ok(cond, 'FAIL: ' + label);
  pass++; console.log('  ✓ ' + label);
}

// --- A DEAD backend: every call rejects (simulates the current NXDOMAIN reality) ---
const deadBackend = {
  getItems: () => Promise.reject(new Error('NXDOMAIN')),
  getRecipes: () => Promise.reject(new Error('NXDOMAIN')),
  getPantry: () => Promise.reject(new Error('NXDOMAIN')),
  addItem: () => Promise.reject(new Error('NXDOMAIN')),
  updateItem: () => Promise.reject(new Error('NXDOMAIN')),
  deleteItem: () => Promise.reject(new Error('NXDOMAIN')),
  addPantryItem: () => Promise.reject(new Error('NXDOMAIN')),
  deletePantryItem: () => Promise.reject(new Error('NXDOMAIN')),
  addRecipe: () => Promise.reject(new Error('NXDOMAIN')),
};

// --- A LIVE backend: records calls, returns server-shaped data ---
function liveBackend() {
  const calls = [];
  const serverItems = [{ id: 'srv-1', name: 'Server Milk', checked: false, qty: '1' }];
  return {
    calls,
    getItems: () => { calls.push('getItems'); return Promise.resolve(serverItems.slice()); },
    getRecipes: () => Promise.resolve([]),
    getPantry: () => Promise.resolve([]),
    addItem: (b) => { calls.push('addItem:' + b.name); return Promise.resolve([b]); },
    updateItem: (id) => { calls.push('updateItem:' + id); return Promise.resolve([{}]); },
    deleteItem: (id) => { calls.push('deleteItem:' + id); return Promise.resolve(null); },
    addPantryItem: (b) => { calls.push('addPantryItem'); return Promise.resolve([b]); },
    deletePantryItem: (id) => { calls.push('deletePantryItem'); return Promise.resolve(null); },
    addRecipe: (b) => { calls.push('addRecipe'); return Promise.resolve([b]); },
  };
}

async function main() {
  console.log('OFFLINE behavior (dead backend):');
  Store.init(deadBackend);
  Store._reset();

  // add is synchronous + persists locally even though backend is dead
  const it = Store.addItem({ name: '3 apples', category: 'produce', qty: '3' });
  ok('addItem returns a record synchronously with an id', it && it.id);
  ok('item is readable immediately from local store', Store.getItems().length === 1);
  ok('item name persisted', Store.getItems()[0].name === '3 apples');
  ok('op was queued for later sync', Store.pendingCount() === 1);

  // toggle + qty
  Store.updateItem(it.id, { checked: true });
  ok('updateItem persists locally', Store.getItems()[0].checked === true);

  // pantry + recipe also work offline
  Store.addPantryItem({ name: 'Olive oil', category: 'pantry' });
  ok('pantry add works offline', Store.getPantry().length === 1);
  const r = Store.addRecipe({ name: 'Test Soup', tags: ['dinner'], ingredients: [], steps: [] });
  ok('recipe add works offline', Store.getRecipes().length === 1 && Store.getRecipes()[0].id === r.id);

  // hydrate against a dead backend must NOT throw and must NOT lose local data
  await Store.hydrate();
  ok('after failed hydrate, online=false', Store.online === false);
  ok('local data survived failed hydrate', Store.getItems().length === 1);
  ok('queue survived failed hydrate (still pending)', Store.pendingCount() >= 1);

  // remove
  Store.removeItem(it.id);
  ok('removeItem works offline', Store.getItems().length === 0);

  console.log('\nONLINE behavior (live backend):');
  const live = liveBackend();
  Store.init(live);
  Store._reset();

  const a = Store.addItem({ name: 'Local Bread', category: 'bakery', qty: '1' });
  ok('local add present before sync', Store.getItems().some(i => i.id === a.id));
  ok('queued 1 op', Store.pendingCount() === 1);

  await Store.hydrate();
  ok('after hydrate, online=true', Store.online === true);
  ok('server item merged in', Store.getItems().some(i => i.id === 'srv-1'));
  ok('local pending item preserved through merge', Store.getItems().some(i => i.id === a.id));
  ok('queued add was flushed to backend', live.calls.some(c => c === 'addItem:Local Bread'));
  ok('queue drained after successful flush', Store.pendingCount() === 0);

  console.log('\nALL ' + pass + ' ASSERTIONS PASSED');
}

main().catch(e => { console.error(e); process.exit(1); });
