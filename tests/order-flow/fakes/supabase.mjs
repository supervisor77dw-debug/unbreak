import { getState } from './state.mjs';

// In-memory stand-in for the PostgREST client. Every statement runs atomically, like one
// SQL statement, and yields first so that parallel requests really interleave. A seeded
// jitter varies how far each request gets, which is what exposes race conditions.
async function tick() {
  const state = getState();
  const rounds = state.random ? 1 + Math.floor(state.random() * 6) : 1;
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
}

const MISSING_COLUMN = {
  code: '42703',
  message: 'column simple_orders.stripe_event_id does not exist',
};

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.mode = 'select';
    this.payload = null;
    this.returning = false;
    this.cardinality = 'many';
    this.touchedColumns = [];
  }

  select() {
    if (this.mode !== 'select') this.returning = true;
    return this;
  }

  insert(payload) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.mode = 'update';
    this.payload = payload;
    this.touchedColumns.push(...Object.keys(payload));
    return this;
  }

  eq(column, value) {
    this.touchedColumns.push(column);
    this.filters.push(row => row[column] === value);
    return this;
  }

  is(column, value) {
    this.touchedColumns.push(column);
    this.filters.push(row => (row[column] ?? null) === value);
    return this;
  }

  single() {
    this.cardinality = 'single';
    return this;
  }

  maybeSingle() {
    this.cardinality = 'maybe';
    return this;
  }

  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }

  async run() {
    await tick();
    const state = getState();
    state.tables[this.table] ||= [];
    const rows = state.tables[this.table];

    if (
      this.table === 'simple_orders' &&
      !state.hasEventColumn &&
      this.touchedColumns.includes('stripe_event_id')
    ) {
      return { data: null, error: MISSING_COLUMN };
    }

    if (this.mode === 'insert') {
      const inserted = [].concat(this.payload).map(row => ({ ...row }));
      rows.push(...inserted);
      return this.shape(inserted);
    }

    const matches = rows.filter(row => this.filters.every(filter => filter(row)));
    if (this.mode === 'update') {
      matches.forEach(row => Object.assign(row, this.payload));
      if (!this.returning) return { data: null, error: null };
    }
    return this.shape(matches.map(row => ({ ...row })));
  }

  shape(found) {
    if (this.cardinality === 'many') return { data: found, error: null };
    if (found.length === 1) return { data: found[0], error: null };
    if (found.length === 0 && this.cardinality === 'maybe') return { data: null, error: null };
    return { data: null, error: { code: 'PGRST116', message: 'expected a single row' } };
  }
}

export function createClient() {
  return {
    from: table => new Query(table),
    rpc: async name => {
      await tick();
      const state = getState();
      if (name !== 'get_next_order_number') throw new Error(`unexpected rpc ${name}`);
      if (state.failRpc) return { data: null, error: { message: 'sequence unavailable' } };
      state.nextOrderNumber += 1;
      return { data: `UO-2026-${String(state.nextOrderNumber).padStart(6, '0')}`, error: null };
    },
  };
}
