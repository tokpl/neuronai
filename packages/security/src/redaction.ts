const SECRET_PATTERNS: RegExp[] = [
  /\b(api[_-]?key|token|secret|password|passwd|authorization)\b\s*[:=]\s*['"]?[^\s'"]+/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\bsk-[A-Za-z0-9]{10,}/g,
  /postgresql:\/\/[^\s]+/gi,
];

/**
 * Redact likely secrets from strings before logging or telemetry.
 */
export function redactSecrets(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

export function assertNoHardcodedSecret(value: string, label: string): void {
  if (/^(sk-|ghp_|xox[baprs]-)/.test(value) || value.includes('password=')) {
    throw new Error(`${label} looks like a live secret — refuse to embed in source/config samples`);
  }
}
