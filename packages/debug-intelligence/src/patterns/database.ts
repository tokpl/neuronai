import type { ErrorPattern } from '../types.js';
import { newId } from '../types.js';

export const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'pat_undefined',
    errorType: 'TypeError',
    signature: 'cannot read propert',
    commonCauses: ['Missing initialization', 'Wrong API response shape', 'Optional chaining skipped'],
    solutions: ['Guard null/undefined', 'Validate API DTO', 'Initialize state before render'],
  },
  {
    id: 'pat_jwt',
    errorType: 'Auth',
    signature: 'jwt|token expired|invalid token',
    commonCauses: ['Refresh/access lifetime mismatch', 'Clock skew', 'Wrong secret/issuer'],
    solutions: ['Unify token lifetime config', 'Centralize auth config', 'Verify issuer/audience'],
  },
  {
    id: 'pat_timeout',
    errorType: 'Timeout',
    signature: 'timeout|etimedout|504',
    commonCauses: ['Upstream latency', 'Missing retry/backoff', 'Blocking work on request thread'],
    solutions: ['Increase timeout thoughtfully', 'Add circuit breaker', 'Move work async'],
  },
  {
    id: 'pat_500',
    errorType: 'HTTP 500',
    signature: 'internal server error|status code 500',
    commonCauses: ['Unhandled exception', 'DB constraint failure', 'Null deref in handler'],
    solutions: ['Inspect stack trace', 'Add error mapping', 'Fix failing dependency call'],
  },
];

export class ErrorPatternDatabase {
  constructor(private readonly patterns: ErrorPattern[] = [...DEFAULT_ERROR_PATTERNS]) {}

  match(errorText: string): ErrorPattern[] {
    const t = errorText.toLowerCase();
    return this.patterns.filter((p) => {
      const parts = p.signature.split('|');
      return parts.some((part) => t.includes(part));
    });
  }

  remember(input: {
    errorType: string;
    signature: string;
    cause: string;
    solution: string;
  }): ErrorPattern {
    const existing = this.patterns.find((p) => p.signature === input.signature);
    if (existing) {
      if (!existing.commonCauses.includes(input.cause)) existing.commonCauses.push(input.cause);
      if (!existing.solutions.includes(input.solution)) existing.solutions.push(input.solution);
      return existing;
    }
    const created: ErrorPattern = {
      id: newId('pat'),
      errorType: input.errorType,
      signature: input.signature,
      commonCauses: [input.cause],
      solutions: [input.solution],
    };
    this.patterns.push(created);
    return created;
  }

  list(): ErrorPattern[] {
    return [...this.patterns];
  }
}

export function createErrorPatternDatabase(patterns?: ErrorPattern[]): ErrorPatternDatabase {
  return new ErrorPatternDatabase(patterns);
}
