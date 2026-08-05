import type { AutoDetectCandidate } from '../types.js';

/**
 * Propose incident candidates from repeated signals — never auto-creates without confirmation.
 */
export class AutomaticIncidentDetector {
  propose(input: {
    recentErrors?: string[];
    failedTests?: string[];
    productionSignals?: string[];
  }): AutoDetectCandidate[] {
    const out: AutoDetectCandidate[] = [];
    const errors = input.recentErrors ?? [];
    const counts = new Map<string, number>();
    for (const e of errors) {
      const key = normalize(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts) {
      if (n >= 2) {
        out.push({
          kind: 'repeated_error',
          title: `Repeated error (${n}×)`,
          detail: key.slice(0, 200),
          requiresConfirmation: true,
        });
      }
    }
    for (const t of input.failedTests ?? []) {
      out.push({
        kind: 'failed_test',
        title: 'Failed test signal',
        detail: t.slice(0, 200),
        requiresConfirmation: true,
      });
    }
    for (const p of input.productionSignals ?? []) {
      out.push({
        kind: 'production_signal',
        title: 'Production issue signal (manual confirm — no prod access by Neuron)',
        detail: p.slice(0, 200),
        requiresConfirmation: true,
      });
    }
    return out;
  }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

export function createAutomaticIncidentDetector(): AutomaticIncidentDetector {
  return new AutomaticIncidentDetector();
}
