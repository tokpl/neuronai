import type { AnalyzedTask } from '../context/task-analyzer.js';
import type { AgentContext } from '../context/context-engine.js';

export interface ImplementationPlan {
  task: string;
  steps: Array<{ order: number; title: string; detail: string }>;
  modules: string[];
  risks: string[];
}

/**
 * Produces an implementation outline - does not generate code.
 */
export class ImplementationPlanner {
  plan(task: AnalyzedTask, context?: AgentContext): ImplementationPlan {
    const modules = context?.relatedModules?.length
      ? context.relatedModules
      : task.affectedAreas;

    const steps: ImplementationPlan['steps'] = [];
    let order = 1;

    steps.push({
      order: order++,
      title: `Scope ${task.type.toLowerCase()} in ${modules[0] ?? 'core'}`,
      detail: `Clarify boundaries for: ${task.raw}`,
    });

    if (modules.includes('database') || task.type === 'MIGRATION') {
      steps.push({
        order: order++,
        title: 'Add / update database tables or migrations',
        detail: 'Keep schema changes compatible with existing dependents',
      });
    }

    for (const area of modules.filter((m) => m !== 'database' && m !== 'general').slice(0, 4)) {
      steps.push({
        order: order++,
        title: `Extend ${area} module`,
        detail: `Wire domain logic and events for ${area}`,
      });
    }

    if (modules.includes('permissions') || modules.includes('auth')) {
      steps.push({
        order: order++,
        title: 'Connect permissions / auth checks',
        detail: 'Reuse existing RBAC/middleware - do not bypass AuthService',
      });
    }

    if (modules.includes('ui') || modules.includes('admin')) {
      steps.push({
        order: order++,
        title: 'Update UI surfaces',
        detail: 'Follow existing component patterns from Neuron context',
      });
    }

    if (modules.includes('api')) {
      steps.push({
        order: order++,
        title: 'Expose / update API endpoints',
        detail: 'Align contracts with gateway and auth middleware',
      });
    }

    steps.push({
      order: order++,
      title: 'Verify against existing decisions & warnings',
      detail: context?.warnings?.length
        ? `Respect: ${context.warnings.slice(0, 3).join('; ')}`
        : 'Run architecture review before merge',
    });

    return {
      task: task.raw,
      steps,
      modules,
      risks: context?.warnings ?? [],
    };
  }
}

export function createImplementationPlanner(): ImplementationPlanner {
  return new ImplementationPlanner();
}
