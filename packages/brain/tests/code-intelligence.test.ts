import { describe, expect, it } from 'vitest';

import { getDependents, getImpact } from '../src/code/queries.js';
import { expandConnectedSlice } from '../src/retrieval/code-docs.js';
import { classifyIntent } from '../src/retrieval/intent.js';
import type { CodeIntelligence } from '@neuronai/types';

const sample: CodeIntelligence = {
  version: 1,
  updatedAt: new Date().toISOString(),
  files: [
    {
      path: 'src/billing/service.ts',
      role: 'service',
      imports: ['src/billing/stripe.ts'],
      exports: ['BillingService'],
      summary: 'Role: service. Exports: BillingService',
    },
    {
      path: 'src/billing/stripe.ts',
      role: 'adapter',
      imports: [],
      exports: ['StripeClient'],
    },
    {
      path: 'src/api/routes.ts',
      role: 'route',
      imports: ['src/billing/service.ts'],
      exports: ['createPayment'],
    },
  ],
  symbols: [
    {
      id: 'src/billing/service.ts#BillingService',
      name: 'BillingService',
      kind: 'class',
      path: 'src/billing/service.ts',
      exported: true,
      role: 'service',
    },
    {
      id: 'src/billing/service.ts#BillingService.createInvoice',
      name: 'createInvoice',
      kind: 'method',
      path: 'src/billing/service.ts',
      parent: 'BillingService',
      exported: true,
    },
    {
      id: 'src/billing/stripe.ts#StripeClient',
      name: 'StripeClient',
      kind: 'class',
      path: 'src/billing/stripe.ts',
      exported: true,
    },
    {
      id: 'src/api/routes.ts#POST /payments',
      name: 'POST /payments',
      kind: 'route',
      path: 'src/api/routes.ts',
      role: 'route',
      exported: true,
    },
  ],
  edges: [
    {
      from: 'src/api/routes.ts',
      to: 'src/billing/service.ts',
      type: 'IMPORTS',
      confidence: 'high',
      evidence: { kind: 'import', detail: 'routes imports service' },
    },
    {
      from: 'src/api/routes.ts',
      to: 'src/billing/service.ts#BillingService.createInvoice',
      type: 'CALLS',
      confidence: 'high',
      evidence: { kind: 'call', detail: 'routes calls billing.createInvoice()' },
    },
    {
      from: 'src/api/routes.ts#POST /payments',
      to: 'src/api/routes.ts#createPayment',
      type: 'ROUTE_TO',
      confidence: 'high',
      evidence: { kind: 'route', detail: 'POST /payments → createPayment' },
    },
    {
      from: 'src/billing/service.ts',
      to: 'src/billing/stripe.ts',
      type: 'IMPORTS',
      confidence: 'high',
      evidence: { kind: 'import', detail: 'service imports stripe' },
    },
  ],
};

describe('code queries', () => {
  it('reports who uses BillingService via verified CALLS/IMPORTS', () => {
    const deps = getDependents(sample, 'BillingService');
    expect(deps.some((d) => d.path.includes('routes'))).toBe(true);
  });

  it('impact lists related files without fabricating certainty', () => {
    const impact = getImpact(sample, 'BillingService');
    expect(impact?.relatedFiles).toContain('src/billing/service.ts');
    expect(impact?.dependencies.every((d) => d.evidence)).toBe(true);
  });

  it('classifies dependency and impact intents', () => {
    expect(classifyIntent('What calls PaymentService?')).toBe('DEPENDENCY');
    expect(classifyIntent('What files would I likely need to change to modify payment processing?')).toBe(
      'IMPACT',
    );
  });

  it('expandConnectedSlice prefers high-confidence dependencies', () => {
    const slice = expandConnectedSlice(
      sample,
      {
        path: 'src/billing/service.ts',
        name: 'BillingService',
        kind: 'symbol',
        reason: 'owns billing',
        related: [],
      },
      'MODIFICATION',
    );
    expect(slice.symbol).toMatch(/BillingService/);
    expect(slice.dependencies.every((d) => d.confidence === 'high' || d.confidence === 'medium')).toBe(
      true,
    );
  });
});
