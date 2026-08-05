import type { AnalyzedError } from '../tracing/types.js';
import { filterTraceText } from '../tracing/filters.js';

export interface AnalyzeErrorInput {
  message: string;
  stack?: string;
  moduleHint?: string;
}

const CATEGORY_RULES: Array<{
  test: RegExp;
  category: string;
  rootCause: string;
  solution: string;
  severity: AnalyzedError['severity'];
}> = [
  {
    test: /ENOENT|not found|missing file/i,
    category: 'filesystem',
    rootCause: 'Required local file or path is missing',
    solution: 'Verify .neuron/ paths and re-run neuron init / scan',
    severity: 'medium',
  },
  {
    test: /EACCES|permission|EPERM/i,
    category: 'permissions',
    rootCause: 'Insufficient filesystem permissions',
    solution: 'Check write access to project and .neuron/',
    severity: 'high',
  },
  {
    test: /timeout|ETIMEDOUT|AbortError/i,
    category: 'latency',
    rootCause: 'Operation exceeded time budget',
    solution: 'Retry, reduce context size, or switch to a local/offline model',
    severity: 'medium',
  },
  {
    test: /rate limit|429|quota/i,
    category: 'provider',
    rootCause: 'Upstream model provider throttling',
    solution: 'Back off, use another provider, or enable offline mode',
    severity: 'medium',
  },
  {
    test: /auth|unauthorized|401|403|api[_-]?key/i,
    category: 'auth',
    rootCause: 'Invalid or missing provider credentials',
    solution: 'Check local env keys; never commit secrets into traces',
    severity: 'high',
  },
  {
    test: /schema|migration|version mismatch/i,
    category: 'schema',
    rootCause: 'Local store schema out of date',
    solution: 'Run neuron update --schema-only',
    severity: 'medium',
  },
  {
    test: /json|parse|syntax/i,
    category: 'data',
    rootCause: 'Malformed local JSON artifact',
    solution: 'Inspect the named .neuron file; restore from backup if corrupt',
    severity: 'medium',
  },
];

export class NeuronErrorAnalyzer {
  analyze(input: AnalyzeErrorInput): AnalyzedError {
    const blob = `${input.message}\n${input.stack ?? ''}`;
    const hit = CATEGORY_RULES.find((r) => r.test.test(blob));
    const affectedModule = filterTraceText(
      input.moduleHint ?? guessModule(blob) ?? 'unknown',
      80,
    );

    if (hit) {
      return {
        category: hit.category,
        rootCause: hit.rootCause,
        affectedModule,
        solution: hit.solution,
        severity: hit.severity,
      };
    }

    return {
      category: 'unknown',
      rootCause: filterTraceText(input.message, 200),
      affectedModule,
      solution: 'Enable neuron debug, re-run the operation, inspect .neuron/traces.json',
      severity: 'low',
    };
  }
}

function guessModule(blob: string): string | undefined {
  const m = blob.match(/packages[/\\]([a-z0-9-]+)/i);
  return m?.[1];
}

export function createNeuronErrorAnalyzer(): NeuronErrorAnalyzer {
  return new NeuronErrorAnalyzer();
}
