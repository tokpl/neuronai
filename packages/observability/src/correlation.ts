import { randomUUID } from 'node:crypto';

import { AsyncLocalStorage } from 'node:async_hooks';

export interface CorrelationStore {
  correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function withCorrelationId<T>(fn: () => T, correlationId = randomUUID()): T {
  return storage.run({ correlationId }, fn);
}

export async function withCorrelationIdAsync<T>(
  fn: () => Promise<T>,
  correlationId = randomUUID(),
): Promise<T> {
  return storage.run({ correlationId }, fn);
}
