import type { SecretFinding } from '../types.js';
import { newId } from '../types.js';

/**
 * Detect likely secrets in text/paths — never stores secret values.
 */
export class SecretDetector {
  detect(input: {
    path: string;
    content: string;
  }): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = input.content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const hit = matchSecretLine(line);
      if (!hit) continue;
      findings.push({
        id: newId('sec'),
        secretType: hit.type,
        location: `${normalizePath(input.path)}:${i + 1}`,
        recommendation: hit.recommendation,
        confidence: hit.confidence,
        evidence: `${hit.type} pattern (value redacted)`,
      });
    }

    // Path-based hints for .env / credentials files without reading values into memory
    if (isSensitivePath(input.path) && findings.length === 0 && input.content.trim()) {
      findings.push({
        id: newId('sec'),
        secretType: 'ENV_OR_CREDENTIALS_FILE',
        location: normalizePath(input.path),
        recommendation:
          'Keep credentials out of git; use env vars / secret managers; never commit .env',
        confidence: 0.7,
        evidence: 'sensitive filename (contents not stored)',
      });
    }

    return findings;
  }

  /** Scan multiple files; values never returned beyond redacted markers */
  scanFiles(files: Array<{ path: string; content: string }>): SecretFinding[] {
    return files.flatMap((f) => this.detect(f));
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function isSensitivePath(path: string): boolean {
  const base = normalizePath(path).split('/').pop() ?? path;
  return (
    /^\.env(\.|$)/i.test(base) ||
    /credentials/i.test(base) ||
    /secrets?/i.test(base) ||
    /id_rsa/i.test(base) ||
    /\.pem$/i.test(base)
  );
}

function matchSecretLine(line: string): {
  type: string;
  recommendation: string;
  confidence: number;
} | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

  // High-confidence assignment patterns — capture groups discarded (never stored)
  const patterns: Array<{
    re: RegExp;
    type: string;
    recommendation: string;
    confidence: number;
  }> = [
    {
      re: /\b(api[_-]?key|apikey)\b\s*[:=]\s*['"]?[^\s'"]{8,}/i,
      type: 'API_KEY',
      recommendation: 'Move API keys to environment variables; rotate if committed',
      confidence: 0.9,
    },
    {
      re: /\b(secret|client[_-]?secret|app[_-]?secret)\b\s*[:=]\s*['"]?[^\s'"]{8,}/i,
      type: 'SECRET',
      recommendation: 'Store secrets outside source control',
      confidence: 0.88,
    },
    {
      re: /\b(password|passwd|pwd)\b\s*[:=]\s*['"]?[^\s'"]{4,}/i,
      type: 'PASSWORD',
      recommendation: 'Never hardcode passwords; use secrets manager',
      confidence: 0.85,
    },
    {
      re: /\b(access[_-]?token|refresh[_-]?token|bearer)\b\s*[:=]\s*['"]?[^\s'"]{12,}/i,
      type: 'TOKEN',
      recommendation: 'Tokens belong in env / secure storage, not source',
      confidence: 0.87,
    },
    {
      re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      type: 'PRIVATE_KEY',
      recommendation: 'Remove private keys from the repo; revoke and rotate',
      confidence: 0.98,
    },
    {
      re: /\b(AKIA[0-9A-Z]{16})\b/,
      type: 'AWS_ACCESS_KEY_ID',
      recommendation: 'Rotate AWS keys immediately; use IAM roles where possible',
      confidence: 0.95,
    },
    {
      re: /\b(sk_live_|sk_test_|rk_live_)[a-zA-Z0-9]{10,}/,
      type: 'PAYMENT_SECRET_KEY',
      recommendation: 'Rotate payment provider keys; never commit live keys',
      confidence: 0.94,
    },
    {
      re: /\b(ghp_|gho_|github_pat_)[a-zA-Z0-9_]{20,}/,
      type: 'GITHUB_TOKEN',
      recommendation: 'Revoke leaked GitHub tokens; use fine-scoped PATs via CI secrets',
      confidence: 0.95,
    },
  ];

  for (const p of patterns) {
    if (p.re.test(trimmed)) {
      return { type: p.type, recommendation: p.recommendation, confidence: p.confidence };
    }
  }
  return null;
}

export function createSecretDetector(): SecretDetector {
  return new SecretDetector();
}
