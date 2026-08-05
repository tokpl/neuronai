import { query } from '../../../packages/db/client.js';
import { withTransaction } from '../../../packages/domain/transactions.js';

export async function listOrders() {
  // Controllers call db package — never open pg here.
  return query('SELECT id, status, total FROM orders ORDER BY id DESC LIMIT 20');
}

export async function createOrder(input) {
  return withTransaction(async () => {
    const rows = await query(
      'INSERT INTO orders (status, total) VALUES ($1, $2) RETURNING id, status, total',
      ['pending', input?.total ?? 0],
    );
    return rows[0];
  });
}
