import { enqueueOutbox } from '../../../packages/db/outbox.js';
import { withTransaction } from '../../../packages/domain/transactions.js';

/**
 * Payments follow the event-driven pattern:
 * HTTP accepts intent → outbox event → worker posts to ledger.
 * Do NOT write ledger rows from this handler.
 */
export async function startPayment(input) {
  return withTransaction(async () => {
    const event = {
      type: 'payment.requested',
      orderId: input?.orderId,
      amount: input?.amount ?? 0,
      provider: 'stripe-checkout',
    };
    await enqueueOutbox(event);
    return { status: 'accepted', event };
  });
}
