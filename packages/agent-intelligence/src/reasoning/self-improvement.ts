import type { MemoryEngine } from '@neuronai/memory-engine';
import type { MemoryRecord } from '@neuronai/types';

import type { AgentContext } from '../context/context-engine.js';
import type { ImplementationPlan } from '../planning/implementation-planner.js';
import type { ArchitectureReview } from '../review/architecture-reviewer.js';

export interface SelfImprovementInput {
  projectId: string;
  task: string;
  plan?: ImplementationPlan;
  review?: ArchitectureReview;
  summary?: string;
  outcome: 'success' | 'partial' | 'failed';
  context?: AgentContext;
}

export interface SelfImprovementResult {
  stored: MemoryRecord[];
  suggestions: string[];
}

/**
 * After a task: capture what worked / failed / new patterns (via Memory Engine).
 */
export class SelfImprovementLoop {
  constructor(private readonly engine: MemoryEngine) {}

  async run(input: SelfImprovementInput): Promise<SelfImprovementResult> {
    const stored: MemoryRecord[] = [];
    const suggestions: string[] = [];

    if (input.outcome === 'success' && input.plan) {
      const memory = await this.engine.createMemory({
        projectId: input.projectId,
        type: 'pattern',
        title: `Worked: ${clip(input.task, 60)}`,
        content: [
          `Task succeeded: ${input.task}`,
          `Plan steps: ${input.plan.steps.map((s) => s.title).join(' → ')}`,
          input.summary ? `Notes: ${input.summary}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        source: 'agent',
        tags: ['self-improvement', 'what-worked', ...input.plan.modules.slice(0, 4)],
        manualImportance: 0.72,
      });
      stored.push(memory);
      suggestions.push('Stored success pattern from completed plan');
    }

    if (input.outcome === 'failed') {
      const memory = await this.engine.createMemory({
        projectId: input.projectId,
        type: 'mistake',
        title: `Failed approach: ${clip(input.task, 60)}`,
        content: [
          `Task failed: ${input.task}`,
          input.review?.issues.join('; ') || 'No review issues captured',
          input.summary ?? '',
        ].join('\n'),
        source: 'agent',
        tags: ['self-improvement', 'what-failed'],
        manualImportance: 0.85,
      });
      stored.push(memory);
      suggestions.push('Stored failure as mistake memory');
    }

    if (input.review && input.review.score >= 80 && input.outcome !== 'failed') {
      suggestions.push('Architecture review scored well - consider saving any new decision explicitly');
    }

    for (const warning of input.context?.warnings ?? []) {
      suggestions.push(`Re-check warning still relevant: ${warning}`);
    }

    return { stored, suggestions };
  }
}

function clip(text: string, n: number): string {
  return text.length <= n ? text : `${text.slice(0, n)}…`;
}

export function createSelfImprovementLoop(engine: MemoryEngine): SelfImprovementLoop {
  return new SelfImprovementLoop(engine);
}
