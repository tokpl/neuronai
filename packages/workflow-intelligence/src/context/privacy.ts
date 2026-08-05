/**
 * Sanitize user-provided technical notes — drop obvious PII / private markers.
 */
const BLOCKED =
  /\b(password|ssn|pesel|private\s+key|my\s+salary|girlfriend|personal\s+email)\b/i;

export function isTechnicalSafe(text: string): boolean {
  if (!text.trim()) return false;
  if (BLOCKED.test(text)) return false;
  return true;
}

export function sanitizeTechnicalText(text: string): string {
  if (!isTechnicalSafe(text)) {
    return '[redacted non-technical or sensitive content]';
  }
  return text.trim();
}

export function assertTechnicalOnly(fields: string[]): void {
  for (const f of fields) {
    if (f && !isTechnicalSafe(f)) {
      throw new Error(
        'Workflow intelligence stores technical work context only — refused sensitive/non-project content.',
      );
    }
  }
}
