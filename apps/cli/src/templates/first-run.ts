/** Copy for the Neuron first-run experience (local-first, no ads). */

export const FIRST_RUN_WELCOME = [
  'Welcome to Neuron.',
  '',
  'I will create a local AI brain for this project.',
] as const;

export const PRIVACY_BANNER = [
  'Neuron is local-first.',
  'Your code stays on your machine.',
  'Telemetry: OFF (never collects source code).',
] as const;

export interface NeuronInitReport {
  projectName: string;
  framework: string;
  database: string;
  modules: number;
  filesAnalyzed: number;
  memoriesCreated: number;
  architectureConfidence: number;
  cursorRules: boolean;
  mcpConfigured: boolean;
}

export function formatNeuronReport(report: NeuronInitReport): string[] {
  return [
    'Neuron Report',
    '',
    'Project:',
    `  ${report.projectName}`,
    '',
    'Detected:',
    '',
    `  Framework:                 ${report.framework}`,
    `  Database:                  ${report.database}`,
    `  Modules:                   ${report.modules}`,
    `  Files analyzed:            ${report.filesAnalyzed}`,
    `  Memories created:          ${report.memoriesCreated}`,
    `  Architecture confidence:   ${report.architectureConfidence}%`,
    '',
    `  Cursor rules:              ${report.cursorRules ? 'yes' : 'no'}`,
    `  MCP configured:            ${report.mcpConfigured ? 'yes' : 'no'}`,
  ];
}
