import type { ContextNeed, NeuronMode } from '../types.js';

export interface ModeContextRequirement {
  modeId: string;
  required: ContextNeed[];
  missing: ContextNeed[];
  available: ContextNeed[];
  ready: boolean;
  hints: string[];
}

/**
 * Each mode declares required context (e.g. Security → files, deps, rules).
 */
export class ModeContextPlanner {
  describe(
    mode: NeuronMode,
    available: ContextNeed[] = [],
  ): ModeContextRequirement {
    const avail = new Set(available);
    const missing = mode.requiredContext.filter((c) => !avail.has(c));
    const present = mode.requiredContext.filter((c) => avail.has(c));
    const hints = missing.map((m) => hintFor(m));
    return {
      modeId: mode.id,
      required: [...mode.requiredContext],
      missing,
      available: present,
      ready: missing.length === 0 || present.length >= Math.ceil(mode.requiredContext.length / 2),
      hints,
    };
  }
}

function hintFor(need: ContextNeed): string {
  switch (need) {
    case 'files':
      return 'Attach or name the files under review';
    case 'dependencies':
      return 'Include package / module dependency context';
    case 'security_rules':
      return 'Load security rules / constitution security policies';
    case 'git_diff':
      return 'Provide the PR/diff or changed paths';
    case 'logs':
      return 'Paste relevant error logs / stack traces';
    case 'incidents':
      return 'Search incident memory with neuron_search_incidents';
    case 'architecture':
      return 'Read .neuron/architecture.md or neuron_architecture_scan';
    case 'knowledge_graph':
      return 'Query graph with neuron_graph_query / neuron_related_knowledge';
    case 'decisions':
      return 'Load decisions via neuron_search_memory or decisions.md';
    case 'performance_signals':
      return 'Share latency / DB / API symptoms';
    case 'docs':
      return 'Point at existing docs under .neuron/docs/';
    case 'team_memory':
      return 'Use neuron_onboarding / neuron_team_context';
    case 'technical_debt':
      return 'Run neuron_refactor_plan or architecture debt memory';
  }
}

export function createModeContextPlanner(): ModeContextPlanner {
  return new ModeContextPlanner();
}
