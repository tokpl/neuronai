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
  language: string;
  framework: string;
  database: string;
  packageManager: string;
  git: boolean;
  modules: number;
  moduleNames: string[];
  filesAnalyzed: number;
  memoriesCreated: number;
  decisions: number;
  conventions: number;
  architectureConfidence: number;
  cursorRules: boolean;
  mcpConfigured: boolean;
}

const UNKNOWN = new Set(['unknown', 'none detected', '']);

function known(value: string): boolean {
  return !UNKNOWN.has(value.toLowerCase());
}

/**
 * The first thing a new user reads. It has to say what Neuron learned, what it
 * could not work out, and what to do next — without inventing numbers.
 */
export function formatNeuronReport(report: NeuronInitReport): string[] {
  const detected: string[] = [];
  if (known(report.language)) detected.push(`  Language        ${report.language}`);
  if (known(report.framework)) detected.push(`  Framework       ${report.framework}`);
  if (known(report.database)) detected.push(`  Database        ${report.database}`);
  if (known(report.packageManager)) detected.push(`  Package manager ${report.packageManager}`);
  detected.push(`  Git repository  ${report.git ? 'yes' : 'no'}`);
  if (report.modules > 0) {
    const preview = report.moduleNames.slice(0, 6).join(', ');
    const more = report.modules > 6 ? `, +${report.modules - 6} more` : '';
    detected.push(`  Modules         ${report.modules} (${preview}${more})`);
  }
  detected.push(`  Files read      ${report.filesAnalyzed}`);

  const learned = [
    `  ${report.memoriesCreated} memories`,
    report.decisions > 0 ? `  ${report.decisions} architecture decisions` : null,
    report.conventions > 0 ? `  ${report.conventions} conventions (suggested — review them)` : null,
    `  Architecture confidence ${report.architectureConfidence}%`,
  ].filter((l): l is string => l !== null);

  const unknown: string[] = [];
  if (!known(report.framework))
    unknown.push('  Framework — no framework signature in the manifest');
  if (!known(report.database)) unknown.push('  Database — no database driver or ORM detected');
  if (report.modules === 0) unknown.push('  Module layout — no clear module directories found');
  if (!report.git) unknown.push('  History — not a Git repository, so no decisions from commits');

  const lines = [
    'What Neuron learned',
    '',
    `Project: ${report.projectName}`,
    '',
    'Detected',
    ...detected,
    '',
    'Brain',
    ...learned,
    '',
  ];

  if (unknown.length) {
    lines.push('Not determined', ...unknown, '');
    lines.push('  Tell it directly: neuron remember "..."', '');
  }

  lines.push(
    'Cursor',
    `  MCP server      ${report.mcpConfigured ? 'registered in .cursor/mcp.json' : 'not registered'}`,
    `  Agent rules     ${report.cursorRules ? 'installed' : 'missing'}`,
  );

  return lines;
}
