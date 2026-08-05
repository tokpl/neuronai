import type { BenchmarkProject } from '../types.js';

export const BENCHMARK_PROJECTS: BenchmarkProject[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce application',
    stack: ['react', 'node', 'postgresql'],
    modules: ['frontend', 'backend', 'db', 'payments', 'cart', 'catalog'],
    rawContextTokens: 15_000,
    seedMemories: [
      {
        title: 'PostgreSQL is the system of record',
        content: 'Decision: All transactional data lives in PostgreSQL. No dual-writes to Mongo.',
        type: 'architecture_decision',
        importanceScore: 0.95,
        tags: ['database', 'postgres'],
      },
      {
        title: 'Payments use event sourcing',
        content: 'All payments use event sourcing with an outbox. Do not write ledger from HTTP handlers.',
        type: 'architecture_decision',
        importanceScore: 0.98,
        tags: ['payments'],
      },
      {
        title: 'React frontend talks via BFF',
        content: 'Frontend (React) calls backend Node BFF only — never hit DB from client.',
        type: 'pattern',
        tags: ['frontend', 'backend'],
      },
      {
        title: 'Do not bypass cart service',
        content: 'Mistake: Controllers must not mutate cart tables directly.',
        type: 'mistake',
        tags: ['cart'],
      },
    ],
  },
  {
    id: 'saas',
    name: 'SaaS application',
    stack: ['typescript', 'node', 'postgres'],
    modules: ['auth', 'billing', 'permissions', 'tenants'],
    rawContextTokens: 12_000,
    seedMemories: [
      {
        title: 'RBAC via permissions service',
        content: 'All authorization goes through permissions package. Never check roles inline in controllers.',
        type: 'architecture_decision',
        importanceScore: 0.97,
        tags: ['auth', 'permissions'],
      },
      {
        title: 'Billing is Stripe + local invoices',
        content: 'Billing module owns Stripe webhooks; invoice rows are local source for UI.',
        type: 'architecture_decision',
        tags: ['billing'],
      },
      {
        title: 'Auth sessions are httpOnly cookies',
        content: 'Pattern: Prefer httpOnly secure cookies over localStorage tokens.',
        type: 'pattern',
        tags: ['auth'],
      },
      {
        title: 'Permission bypass incident',
        content: 'Mistake: Missing tenantId filter caused cross-tenant reads. Always scope by tenant.',
        type: 'mistake',
        tags: ['permissions', 'security'],
      },
    ],
  },
  {
    id: 'game-server',
    name: 'Game server architecture',
    stack: ['node', 'redis', 'postgresql'],
    modules: ['modules', 'economy', 'users', 'permissions', 'events'],
    rawContextTokens: 14_000,
    seedMemories: [
      {
        title: 'Economy mutations are event-driven',
        content: 'Decision: Currency changes publish domain events; never mutate balances ad-hoc.',
        type: 'architecture_decision',
        tags: ['economy', 'events'],
      },
      {
        title: 'Permissions gate every command',
        content: 'Game commands must pass permissions module before economy/users handlers.',
        type: 'business_rule',
        tags: ['permissions'],
      },
      {
        title: 'Users module owns profiles',
        content: 'Profile and inventory live in users module; economy only stores balances.',
        type: 'pattern',
        tags: ['users', 'economy'],
      },
      {
        title: 'Event bus is source of truth for async',
        content: 'Modules communicate via events package — avoid direct cross-module DB access.',
        type: 'architecture_decision',
        tags: ['events', 'modules'],
      },
    ],
  },
];

export function getBenchmarkProject(id: string): BenchmarkProject {
  const p = BENCHMARK_PROJECTS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown benchmark project: ${id}`);
  return p;
}
