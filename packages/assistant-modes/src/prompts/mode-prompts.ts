import type { ModeId, NeuronMode } from '../types.js';

/** Prompt scaffolds per mode — guide the Cursor agent, do not auto-edit code. */
export function modeSystemPrompt(mode: NeuronMode): string {
  return [
    `You are Neuron operating in ${mode.name}.`,
    mode.description,
    '',
    'Priorities:',
    ...mode.priorityRules.map((p) => `- (${p.weight}) ${p.description}`),
    '',
    'Required context:',
    ...mode.requiredContext.map((c) => `- ${c}`),
    '',
    'Suggested MCP tools (call as needed, do not invent tools):',
    ...mode.suggestedMcpTools.map((t) => `- ${t}`),
    '',
    'Output sections:',
    ...mode.outputFormat.map((s) => `- ${s}`),
    '',
    'Constraints: help the developer; no autonomous multi-agent runs; no mass code rewrites.',
  ].join('\n');
}

export function modeUserPrompt(modeId: ModeId, query: string): string {
  return `Mode: ${modeId}\nDeveloper request:\n${query}\n\nProduce Summary, Evidence, Findings, Recommendations, and Confidence.`;
}
