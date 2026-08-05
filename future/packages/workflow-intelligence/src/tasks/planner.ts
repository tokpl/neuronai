import type { TaskPlan } from '../types.js';

/**
 * Architecture-aware breakdown — not a plain TODO list.
 */
export class TaskPlanner {
  plan(input: {
    feature: string;
    architectureNotes?: string[];
    dependencies?: string[];
    risks?: string[];
  }): TaskPlan {
    const feature = input.feature.trim();
    const steps = [
      { order: 1, title: 'Domain model', detail: `Define domain concepts for ${feature}` },
      {
        order: 2,
        title: 'Database changes',
        detail: 'Migrations / schema updates aligned with domain',
        risk: 'Migration mismatch',
      },
      {
        order: 3,
        title: 'Services',
        detail: 'Application services and invariants',
        risk: input.risks?.[0],
      },
      { order: 4, title: 'API', detail: 'HTTP/API surface + authz' },
      { order: 5, title: 'UI', detail: 'Frontend integration for the feature' },
      { order: 6, title: 'Tests', detail: 'Unit / integration coverage for critical paths' },
    ];

    // Specialize known feature shapes
    if (/marketplace/i.test(feature)) {
      steps[0]!.detail = 'Marketplace domain: listings, sellers, orders';
      steps[2]!.detail = 'Listing, search, and order services';
    }
    if (/refund|payment/i.test(feature)) {
      steps[2]!.detail = 'Payment/refund services; idempotency';
      steps[2]!.risk = steps[2]!.risk ?? 'Payment path regressions';
    }

    return {
      feature,
      steps,
      architectureNotes: input.architectureNotes ?? [],
      dependencies: input.dependencies ?? [],
      risks: input.risks?.length
        ? input.risks
        : ['Respect existing ADRs', 'Keep authz on mutating endpoints'],
    };
  }
}

export function createTaskPlanner(): TaskPlanner {
  return new TaskPlanner();
}
