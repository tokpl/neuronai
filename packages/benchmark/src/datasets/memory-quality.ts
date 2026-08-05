import type { MemoryQualitySample } from '../types.js';

/** Gold labels for whether Neuron should persist a candidate memory. */
export const MEMORY_QUALITY_SAMPLES: MemoryQualitySample[] = [
  {
    title: 'All payments use event sourcing',
    content: 'Decision: ledger updates go through outbox events only.',
    label: 'good',
    reason: 'Durable architecture decision with high reuse.',
  },
  {
    title: 'RBAC via permissions service',
    content: 'Never check roles inline in controllers.',
    label: 'good',
    reason: 'Cross-cutting security pattern.',
  },
  {
    title: 'PostgreSQL is system of record',
    content: 'No dual-writes to document stores for transactions.',
    label: 'good',
    reason: 'Stack constraint agents routinely violate.',
  },
  {
    title: 'Changed variable name x',
    content: 'Renamed x to y in one function.',
    label: 'bad',
    reason: 'Trivial local rename — noise, not project memory.',
  },
  {
    title: 'Fixed typo in comment',
    content: 'Corrected spelling in README line 12.',
    label: 'bad',
    reason: 'Non-durable trivia.',
  },
  {
    title: 'Temporary console.log',
    content: 'Added debug log while investigating.',
    label: 'bad',
    reason: 'Ephemeral debugging artifact.',
  },
  {
    title: 'Permission bypass incident',
    content: 'Missing tenantId filter caused cross-tenant reads.',
    label: 'good',
    reason: 'Mistake memory prevents regressions.',
  },
  {
    title: 'Bump package patch',
    content: 'Updated left-pad from 1.0.0 to 1.0.1.',
    label: 'bad',
    reason: 'Dependency noise without architectural impact.',
  },
];
