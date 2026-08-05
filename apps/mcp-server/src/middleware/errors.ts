import { NeuronError } from '@neuronai/types';

export interface McpErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function toMcpError(error: unknown): McpErrorBody {
  if (error instanceof NeuronError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'NEURON_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    },
  };
}

export function textResult(data: unknown, isError = false) {
  return {
    isError,
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function okResult(data: unknown) {
  return textResult({ ok: true, ...unwrap(data) });
}

export function failResult(error: unknown) {
  return textResult(toMcpError(error), true);
}

function unwrap(data: unknown): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { data };
}
