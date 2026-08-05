/**
 * Database access layer — the only module that should talk to Postgres.
 * HTTP controllers must import from here (or domain helpers), never `pg` directly.
 */

const memory = {
  orders: [
    { id: 1, status: 'paid', total: 42 },
    { id: 2, status: 'pending', total: 15 },
  ],
  outbox: [],
};

export async function query(sql, params = []) {
  if (/SELECT.*FROM orders/i.test(sql)) {
    return [...memory.orders];
  }
  if (/INSERT INTO orders/i.test(sql)) {
    const row = {
      id: memory.orders.length + 1,
      status: params[0] ?? 'pending',
      total: params[1] ?? 0,
    };
    memory.orders.unshift(row);
    return [row];
  }
  return [];
}

export async function enqueueOutbox(event) {
  memory.outbox.push({ id: memory.outbox.length + 1, event, createdAt: new Date().toISOString() });
  return memory.outbox.at(-1);
}
