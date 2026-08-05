export type NeuronErrorCode =
  | 'NEURON_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AUTH_ERROR'
  | 'MEMORY_ERROR'
  | 'STORAGE_ERROR'
  | 'INTEGRATION_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'CONFIG_ERROR';

export interface NeuronErrorOptions {
  code?: NeuronErrorCode;
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class NeuronError extends Error {
  readonly code: NeuronErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: NeuronErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'NeuronError';
    this.code = options.code ?? 'NEURON_ERROR';
    this.details = options.details;
  }
}

export class ValidationError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'VALIDATION_ERROR', details });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'NOT_FOUND', details });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'CONFLICT', details });
    this.name = 'ConflictError';
  }
}

export class MemoryError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'MEMORY_ERROR', details });
    this.name = 'MemoryError';
  }
}

export class StorageError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'STORAGE_ERROR', details });
    this.name = 'StorageError';
  }
}

export class IntegrationError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'INTEGRATION_ERROR', details });
    this.name = 'IntegrationError';
  }
}

export class ConfigError extends NeuronError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'CONFIG_ERROR', details });
    this.name = 'ConfigError';
  }
}

export class NotImplementedError extends NeuronError {
  constructor(feature: string) {
    super(`${feature} is not implemented yet`, {
      code: 'NOT_IMPLEMENTED',
      details: { feature },
    });
    this.name = 'NotImplementedError';
  }
}
