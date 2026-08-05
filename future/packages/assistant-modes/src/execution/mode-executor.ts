import type { ModeOutput, NeuronMode } from '../types.js';
import { clamp01 } from '../types.js';
import { modeSystemPrompt } from '../prompts/mode-prompts.js';

export interface ExecuteModeInput {
  mode: NeuronMode;
  query: string;
  /** Optional hints already gathered */
  evidence?: string[];
  findings?: string[];
  routeConfidence?: number;
}

/**
 * Executes a mode as an advisory workflow plan (no code mutation).
 */
export class ModeExecutor {
  run(input: ExecuteModeInput): ModeOutput {
    const focus = input.mode.priorityRules
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map((p) => p.description);

    const findings = input.findings?.length
      ? input.findings
      : defaultFindings(input.mode, input.query);

    const recommendations = defaultRecommendations(input.mode);
    const evidence = input.evidence?.length
      ? input.evidence
      : [
          `Capabilities: ${input.mode.enabledCapabilities.join(', ')}`,
          `Context needs: ${input.mode.requiredContext.join(', ')}`,
        ];

    const confidence = clamp01(
      (input.routeConfidence ?? 0.7) * 0.6 +
        Math.min(1, evidence.length / 4) * 0.2 +
        0.2,
    );

    return {
      modeId: input.mode.id,
      summary: `${input.mode.name}: ${summarizeQuery(input.query)}`,
      evidence,
      findings,
      recommendations,
      confidence,
      analysisFocus: focus,
      suggestedTools: input.mode.suggestedMcpTools,
    };
  }

  promptBundle(mode: NeuronMode, query: string): { system: string; user: string } {
    return {
      system: modeSystemPrompt(mode),
      user: `Developer request:\n${query}`,
    };
  }
}

function summarizeQuery(q: string): string {
  const t = q.replace(/\s+/g, ' ').trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t || 'No query provided';
}

function defaultFindings(mode: NeuronMode, query: string): string[] {
  switch (mode.id) {
    case 'architect':
      return [
        'Analyze module boundaries and dependency directions',
        'Identify patterns and scalability tradeoffs',
        `Request focus: ${summarizeQuery(query)}`,
      ];
    case 'code_review':
      return ['Scan diff for issues', 'Check security/performance/architecture risks'];
    case 'debug':
      return ['Collect evidence from logs/incidents', 'Form root-cause hypotheses'];
    case 'security_review':
      return ['Scan for secrets and threat patterns', 'Rank findings by severity'];
    case 'performance':
      return ['Identify likely bottlenecks', 'Estimate impact before optimizing'];
    case 'documentation':
      return ['Map architecture graph to doc sections', 'Draft guides for developers'];
    case 'onboarding':
      return ['Build a learning path', 'List important concepts and common mistakes'];
    case 'refactoring':
      return ['Capture before/after intent', 'List migration risks — no auto-rewrite'];
  }
}

function defaultRecommendations(mode: NeuronMode): string[] {
  return [
    `Call: ${mode.suggestedMcpTools[0] ?? 'neuron_get_context'}`,
    `Then: ${mode.suggestedMcpTools[1] ?? mode.suggestedMcpTools[0] ?? 'neuron_search_memory'}`,
    'Return structured Summary / Evidence / Findings / Recommendations / Confidence',
    'Do not apply unsupervised mass code changes',
  ];
}

export function createModeExecutor(): ModeExecutor {
  return new ModeExecutor();
}
