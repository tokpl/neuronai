import type { ImplementationPlan, RequirementAnalysis } from '../types.js';

/**
 * Stepwise implementation plan — never emits application code.
 */
export class ImplementationPlanner {
  plan(requirement: RequirementAnalysis): ImplementationPlan {
    const steps = [
      {
        order: 1,
        title: 'Database changes',
        detail: `Schema / migrations for ${requirement.feature} (keep backward compatible with ${requirement.affected.filter((a) => /user|database|transaction/i.test(a)).join(', ') || 'existing data'}).`,
      },
      {
        order: 2,
        title: 'Backend services',
        detail: `Implement domain services for ${requirement.feature}; prefer existing service patterns.`,
      },
      {
        order: 3,
        title: 'API endpoints',
        detail: 'Expose thin controllers/routes that delegate to services — no business logic in controllers.',
      },
      {
        order: 4,
        title: 'Frontend integration',
        detail: 'Wire UI only after API contracts stabilize; reuse existing BFF/client patterns.',
      },
      {
        order: 5,
        title: 'Tests',
        detail: 'Unit + integration covering happy path, authz, and failure modes (esp. money/permissions).',
      },
      {
        order: 6,
        title: 'Documentation',
        detail: 'Update .neuron decisions/architecture and developer docs; propose ADR for approval.',
      },
    ];

    if (requirement.affected.includes('Notifications')) {
      steps.splice(3, 0, {
        order: 0,
        title: 'Events / notifications',
        detail: 'Publish domain events; avoid tight coupling to notification providers.',
      });
      // renumber
      steps.forEach((s, i) => {
        s.order = i + 1;
      });
    }

    return { task: requirement.raw, steps };
  }
}

export function createImplementationPlanner(): ImplementationPlanner {
  return new ImplementationPlanner();
}
