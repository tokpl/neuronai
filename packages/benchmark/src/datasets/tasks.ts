import type { BenchmarkTask } from '../types.js';

/** Canonical task dataset across FEATURE / BUGFIX / REFACTOR / ARCHITECTURE / DEBUG. */
export const TASK_DATASET: BenchmarkTask[] = [
  {
    id: 'feature-notifications',
    kind: 'FEATURE',
    prompt: 'Add notifications',
    expectedFacts: ['event', 'permissions', 'user', 'email', 'outbox', 'notification'],
    noiseFacts: ['css', 'rename variable', 'todo comment'],
    architectureConstraints: ['prefer existing event bus', 'do not bypass permissions'],
  },
  {
    id: 'bugfix-permission-bypass',
    kind: 'BUGFIX',
    prompt: 'Fix permission bypass',
    expectedFacts: ['permission', 'tenant', 'rbac', 'security', 'bypass'],
    noiseFacts: ['styling', 'readme typo'],
    architectureConstraints: ['always scope by tenant', 'use permissions service'],
  },
  {
    id: 'refactor-database-layer',
    kind: 'REFACTOR',
    prompt: 'Replace database layer',
    expectedFacts: ['postgres', 'migration', 'database', 'repository', 'transaction'],
    noiseFacts: ['redux', 'css module'],
    architectureConstraints: ['PostgreSQL remains system of record', 'no dual-writes'],
  },
  {
    id: 'architecture-payment-system',
    kind: 'ARCHITECTURE',
    prompt: 'Design payment system',
    expectedFacts: ['payment', 'event sourcing', 'outbox', 'ledger', 'stripe', 'billing'],
    noiseFacts: ['changed variable name', 'random note'],
    architectureConstraints: ['payments use event sourcing', 'no ledger writes from HTTP'],
  },
  {
    id: 'debug-memory-leak',
    kind: 'DEBUG',
    prompt: 'Find source of memory leak',
    expectedFacts: ['event', 'listener', 'cache', 'subscription', 'leak'],
    noiseFacts: ['logo svg', 'changelog'],
    architectureConstraints: ['prefer instrumenting event subscribers'],
  },
];

export function getTask(id: string): BenchmarkTask {
  const t = TASK_DATASET.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown task: ${id}`);
  return t;
}
