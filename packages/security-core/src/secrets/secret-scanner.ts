import type { SecretFinding } from '../types.js';
import { newId } from '../types.js';

interface SecretRule {
  kind: SecretFinding['kind'];
  test: RegExp;
  severity: SecretFinding['severity'];
  label: string;
}

const RULES: SecretRule[] = [
  {
    kind: 'api_key',
    test: /\b(sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16})\b/g,
    severity: 'critical',
    label: 'API key',
  },
  {
    kind: 'token',
    test: /\b(ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/gi,
    severity: 'critical',
    label: 'Token',
  },
  {
    kind: 'password',
    test: /\b(password|passwd|pwd)\b\s*[:=]\s*['"]?[^\s'"]{4,}/gi,
    severity: 'high',
    label: 'Password',
  },
  {
    kind: 'private_key',
    test: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    label: 'Private key',
  },
  {
    kind: 'credential',
    test: /\b(api[_-]?key|secret|credentials?)\b\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
    severity: 'high',
    label: 'Credential',
  },
  {
    kind: 'other',
    test: /postgresql:\/\/[^\s]+/gi,
    severity: 'high',
    label: 'Connection string',
  },
];

/**
 * Detect secrets before AI requests — never returns raw secret values.
 */
export class SecretScanner {
  scan(text: string, location = 'context'): SecretFinding[] {
    const findings: SecretFinding[] = [];
    for (const rule of RULES) {
      const re = new RegExp(rule.test.source, rule.test.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        findings.push({
          id: newId('sec'),
          kind: rule.kind,
          location,
          evidence: `${rule.label} pattern (value redacted)`,
          severity: rule.severity,
        });
        if (findings.length >= 50) return findings;
      }
    }
    return findings;
  }

  scanFiles(files: Array<{ path: string; content: string }>): SecretFinding[] {
    return files.flatMap((f) => this.scan(f.content, f.path.replace(/\\/g, '/')));
  }
}

export function createSecretScanner(): SecretScanner {
  return new SecretScanner();
}
