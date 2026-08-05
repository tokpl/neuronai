import type { BenchmarkCase } from '../types.js';

/** Sample dataset fragments for tests and demos. */
export const SAMPLE_AUTH_DATASET: BenchmarkCase = {
  id: 'auth-tests',
  category: 'architecture',
  question: 'How authentication works?',
  expectedKeywords: ['auth', 'session', 'jwt', 'permission'],
  unexpectedKeywords: ['frontend button', 'css'],
  goldMemoryTitles: ['Auth service', 'Session store'],
};

export const SAMPLE_PAYMENT_DATASET: BenchmarkCase = {
  id: 'payment-tests',
  category: 'architecture',
  question: 'How should I implement payments?',
  expectedKeywords: ['payment', 'idempotency', 'webhook', 'ledger'],
  unexpectedKeywords: ['mongodb cache'],
};
