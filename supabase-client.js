// Supabase Client - Shopping List
const SUPABASE_URL = SUPABASE_CONFIG.url;
const SUPABASE_KEY = SUPABASE_CONFIG.key;

const supabase = {
  async query(table, method, options = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
    };

    if (options.select) url += `?select=${options.select}`;
    if (options.filters) url += (url.includes('?') ? '&' : '?') + options.filters;
    if (options.order) url += (url.includes('?') ? '&' : '?') + `order=${options.order}`;

    const res = await fetch(url, {
      method: method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error: ${res.status} ${err}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  async getItems() {
    return this.query('items', 'GET', { select: '*', order: 'created_at.asc' });
  },

  async addItem(item) {
    return this.query('items', 'POST', { body: item });
  },

  async updateItem(id, updates) {
    return this.query('items', 'PATCH', {
      body: updates,
      filters: `id=eq.${id}`,
    });
  },

  async deleteItem(id) {
    return this.query('items', 'DELETE', {
      filters: `id=eq.${id}`,
      prefer: 'return=minimal',
    });
  },

  async getRecipes() {
    return this.query('recipes', 'GET', { select: '*', order: 'created_at.desc' });
  },

  async addRecipe(recipe) {
    return this.query('recipes', 'POST', { body: recipe });
  },

  async updateRecipe(id, updates) {
    return this.query('recipes', 'PATCH', { body: updates, filters: `id=eq.${id}` });
  },

  // Pantry
  async getPantry() {
    return this.query('pantry', 'GET', { select: '*', order: 'created_at.asc' });
  },

  async addPantryItem(item) {
    return this.query('pantry', 'POST', { body: item });
  },

  async deletePantryItem(id) {
    return this.query('pantry', 'DELETE', { filters: `id=eq.${id}`, prefer: 'return=minimal' });
  },

  // Realtime subscription
  subscribeToItems(callback) {
    const wsUrl = SUPABASE_URL.replace('https://', 'wss://') + 
      `/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;
    
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        // Join the items channel
        ws.send(JSON.stringify({
          topic: 'realtime:public:items',
          event: 'phx_join',
          payload: { config: { broadcast: { self: true }, postgres_changes: [{ event: '*', schema: 'public', table: 'items' }] } },
          ref: '1',
        }));
        console.log('Realtime connected');
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === 'postgres_changes') {
            callback(msg.payload);
          }
        } catch (err) {}
      };
      ws.onerror = () => console.log('Realtime error - falling back to polling');
      ws.onclose = () => {
        console.log('Realtime disconnected, reconnecting in 5s...');
        setTimeout(() => this.subscribeToItems(callback), 5000);
      };

      // Heartbeat
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
        }
      }, 30000);
    } catch (e) {
      console.log('Realtime not available, using polling');
    }
  }
};
