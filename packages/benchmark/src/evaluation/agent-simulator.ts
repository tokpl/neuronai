import type { BenchmarkMode, BenchmarkTask, SimulatedAgentStep } from '../types.js';

/**
 * Simulates agent task → retrieval → decision → evaluation.
 * Does not generate code or call an LLM.
 */
export class AgentSimulator {
  simulate(input: {
    task: BenchmarkTask;
    mode: BenchmarkMode;
    contextText: string;
    retrievedTitles: string[];
  }): SimulatedAgentStep {
    const hay = input.contextText.toLowerCase();
    const covered = input.task.expectedFacts.filter((f) => hay.includes(f.toLowerCase()));
    const missing = input.task.expectedFacts.filter((f) => !hay.includes(f.toLowerCase()));

    const decision =
      input.mode === 'WITH_NEURON'
        ? covered.length >= Math.ceil(input.task.expectedFacts.length * 0.5)
          ? `Follow project constraints for "${input.task.prompt}" using retrieved decisions.`
          : `Request more Neuron context — missing: ${missing.slice(0, 3).join(', ')}`
        : `Infer from code only for "${input.task.prompt}" (higher risk of architecture drift).`;

    const evaluationNotes = [
      `mode=${input.mode}`,
      `facts_covered=${covered.length}/${input.task.expectedFacts.length}`,
      input.mode === 'WITH_NEURON'
        ? 'Neuron context available for architecture compliance checks'
        : 'No memory layer — agent may reinvent decisions',
      missing.length ? `gaps=${missing.slice(0, 4).join('|')}` : 'no critical gaps detected',
    ];

    return {
      task: input.task.prompt,
      mode: input.mode,
      retrievedTitles: input.retrievedTitles,
      decision,
      evaluationNotes,
    };
  }
}

export function createAgentSimulator(): AgentSimulator {
  return new AgentSimulator();
}
