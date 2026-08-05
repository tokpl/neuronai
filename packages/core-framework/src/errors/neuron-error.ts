import type { ErrorCategory, ErrorSeverity, ModuleName, NeuronErrorShape } from '../types.js';

export class NeuronError extends Error implements NeuronErrorShape {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly module: ModuleName | 'core';
  readonly solutionHint: string;
  override readonly cause?: string;

  constructor(shape: NeuronErrorShape) {
    super(shape.message);
    this.name = 'NeuronError';
    this.category = shape.category;
    this.severity = shape.severity;
    this.module = shape.module;
    this.solutionHint = shape.solutionHint;
    this.cause = shape.cause;
  }

  toJSON(): NeuronErrorShape & { message: string } {
    return {
      category: this.category,
      severity: this.severity,
      module: this.module,
      message: this.message,
      solutionHint: this.solutionHint,
      cause: this.cause,
    };
  }
}

/**
 * NeuronErrorSystem — structured errors with solution hints.
 */
export class NeuronErrorSystem {
  format(error: unknown): NeuronErrorShape {
    if (error instanceof NeuronError) {
      return error.toJSON();
    }
    return {
      category: 'internal',
      severity: 'medium',
      module: 'core',
      message: error instanceof Error ? error.message : String(error),
      solutionHint: 'Check logs and module health: neuron doctor / core healthCheck.',
      cause: error instanceof Error ? error.stack : undefined,
    };
  }

  create(shape: NeuronErrorShape): NeuronError {
    return new NeuronError(shape);
  }
}

export function createNeuronErrorSystem(): NeuronErrorSystem {
  return new NeuronErrorSystem();
}
