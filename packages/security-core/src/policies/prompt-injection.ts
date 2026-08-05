import type { InjectionFinding } from '../types.js';
import { newId } from '../types.js';

const INJECTION_PATTERNS: Array<{ pattern: string; test: RegExp; severity: InjectionFinding['severity'] }> =
  [
    {
      pattern: 'ignore previous instructions',
      test: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
      severity: 'high',
    },
    {
      pattern: 'disregard system prompt',
      test: /disregard\s+(the\s+)?(system|safety|security)\s+(prompt|rules?|policy)/i,
      severity: 'high',
    },
    {
      pattern: 'send this file',
      test: /send\s+(this|the)\s+(file|secrets?|credentials?|\.env)\b/i,
      severity: 'high',
    },
    {
      pattern: 'disable security',
      test: /disable\s+(all\s+)?(security|safety|guardrails?|permissions?)/i,
      severity: 'high',
    },
    {
      pattern: 'exfiltrate / exfiltration',
      test: /\b(exfiltrate|upload\s+secrets?|leak\s+(the\s+)?(api|keys?))\b/i,
      severity: 'high',
    },
    {
      pattern: 'act as unrestricted',
      test: /\b(jailbreak|DAN\b|act\s+as\s+(an?\s+)?unrestricted)\b/i,
      severity: 'medium',
    },
    {
      pattern: 'override neuron policy',
      test: /override\s+(neuron|project)\s+(policy|rules?|constitution)/i,
      severity: 'medium',
    },
  ];

/**
 * Detect prompt-injection style content in README, comments, docs, code strings.
 */
export class PromptInjectionDetector {
  analyze(text: string, sourceHint = 'unknown'): InjectionFinding[] {
    const findings: InjectionFinding[] = [];
    for (const rule of INJECTION_PATTERNS) {
      const m = text.match(rule.test);
      if (!m) continue;
      const idx = m.index ?? 0;
      const excerpt = text.slice(Math.max(0, idx - 20), idx + (m[0]?.length ?? 0) + 40).trim();
      findings.push({
        id: newId('inj'),
        pattern: rule.pattern,
        excerpt: excerpt.slice(0, 160),
        sourceHint,
        severity: rule.severity,
      });
    }
    return findings;
  }
}

export function createPromptInjectionDetector(): PromptInjectionDetector {
  return new PromptInjectionDetector();
}
