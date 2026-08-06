/**
 * Lightweight concept tags for map entries.
 * Mirrors the retrieval vocabulary so scan-written locations and query
 * expansion land on the same words — without importing @neuronai/brain.
 */

const HINTS: Array<{ concept: string; pattern: RegExp }> = [
  { concept: 'auth', pattern: /\b(auth|jwt|oauth|session|login|password|permission)\b/i },
  { concept: 'billing', pattern: /\b(billing|payment|stripe|invoice|checkout|subscription)\b/i },
  { concept: 'database', pattern: /\b(database|db|prisma|drizzle|mongo|postgres|repository|schema|migration)\b/i },
  { concept: 'api', pattern: /\b(api|route|router|endpoint|controller|handler|middleware)\b/i },
  { concept: 'testing', pattern: /\b(test|spec|vitest|jest|playwright)\b/i },
  { concept: 'configuration', pattern: /\b(config|env|setting|dotenv)\b/i },
  { concept: 'users', pattern: /\b(user|account|profile|customer)\b/i },
  { concept: 'security', pattern: /\b(security|secret|encrypt|csrf|xss)\b/i },
  { concept: 'deployment', pattern: /\b(deploy|docker|kubernetes|ci|pipeline)\b/i },
  { concept: 'validation', pattern: /\b(validat|zod|joi|yup)\b/i },
];

export function conceptsFromText(...parts: Array<string | undefined>): string[] {
  const haystack = parts.filter(Boolean).join(' ');
  if (!haystack) return [];
  const found: string[] = [];
  for (const hint of HINTS) {
    if (hint.pattern.test(haystack) && !found.includes(hint.concept)) {
      found.push(hint.concept);
    }
  }
  return found;
}
