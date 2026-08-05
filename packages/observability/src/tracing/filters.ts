import { redactSecrets } from '@neuronai/security';

const SENSITIVE_PATH =
  /(\.env|credentials|secrets?|id_rsa|\.pem|password|api[_-]?key)/i;

/**
 * Filter secrets and sensitive paths from strings before trace persistence.
 */
export function filterTraceText(input: string, max = 500): string {
  let out = redactSecrets(input);
  if (SENSITIVE_PATH.test(out)) {
    out = out.replace(SENSITIVE_PATH, '[FILTERED_PATH]');
  }
  // Drop long code blocks
  out = out.replace(/```[\s\S]*?```/g, '[CODE_OMITTED]');
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function filterPathList(paths: string[]): string[] {
  return paths
    .filter((p) => !SENSITIVE_PATH.test(p))
    .map((p) => p.replace(/\\/g, '/').slice(0, 200))
    .slice(0, 40);
}
