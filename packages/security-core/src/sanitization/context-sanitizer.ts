import { redactSecrets } from '@neuron-ai-memory/security';

import { createSecretScanner } from '../secrets/secret-scanner.js';
import type { SanitizationResult } from '../types.js';

/**
 * Sanitize context before sending to AI models.
 * Example: OPENAI_KEY=abc123 → OPENAI_KEY=[REDACTED]
 */
export class ContextSanitizer {
  private readonly scanner = createSecretScanner();

  sanitize(input: string, location = 'context'): SanitizationResult {
    const findings = this.scanner.scan(input, location);
    let sanitized = redactSecrets(input);

    // Explicit KEY=value style masking for common env patterns
    sanitized = sanitized.replace(
      /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/g,
      '$1=[REDACTED]',
    );
    sanitized = sanitized.replace(
      /\b(OPENAI_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY)\s*=\s*[^\s"'`]+/gi,
      (_, name: string) => `${name}=[REDACTED]`,
    );

    const redactionCount =
      findings.length + (sanitized === input ? 0 : Math.max(1, findings.length));

    return {
      originalLength: input.length,
      sanitized,
      redactionCount: sanitized === input ? findings.length : Math.max(redactionCount, 1),
      findings,
    };
  }
}

export function createContextSanitizer(): ContextSanitizer {
  return new ContextSanitizer();
}
