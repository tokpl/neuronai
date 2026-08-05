import { ui } from '../ui/output.js';

export interface NeuronCliErrorOptions {
  title: string;
  reason: string;
  solution: string;
  commands?: string[];
}

/** Human-readable CLI failures (never opaque "Error 500"). */
export class NeuronCliError extends Error {
  readonly reason: string;
  readonly solution: string;
  readonly commands: string[];

  constructor(options: NeuronCliErrorOptions) {
    super(options.title);
    this.name = 'NeuronCliError';
    this.reason = options.reason;
    this.solution = options.solution;
    this.commands = options.commands ?? [];
  }
}

export function printNeuronError(error: NeuronCliError): void {
  ui.error(error.message);
  ui.blank();
  console.log('Reason:');
  ui.info(`  ${error.reason}`);
  ui.blank();
  console.log('Solution:');
  ui.info(`  ${error.solution}`);
  for (const cmd of error.commands) {
    ui.suggest(cmd);
  }
}

export function isNeuronCliError(error: unknown): error is NeuronCliError {
  return error instanceof NeuronCliError;
}
