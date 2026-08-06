/**
 * Deterministic local tokenizer for Neuron retrieval.
 * No network, no models, no dependencies — same input always yields the same terms.
 */

/** Grammatical filler that carries no project meaning. */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'out',
  'so',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'to',
  'up',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

/**
 * Verbs that describe the *action* of a task rather than its subject.
 * They still score, but weakly, and they never count toward query coverage —
 * otherwise "add X" and "fix X" would match every memory containing "add".
 */
const TASK_VERBS = new Set([
  'add',
  'adding',
  'build',
  'change',
  'check',
  'convert',
  'create',
  'delete',
  'document',
  'ensure',
  'extend',
  'fix',
  'handle',
  'implement',
  'improve',
  'introduce',
  'make',
  'migrate',
  'move',
  'need',
  'prefer',
  'refactor',
  'remove',
  'rename',
  'replace',
  'set',
  'should',
  'support',
  'update',
  'use',
  'want',
  'work',
  'write',
]);

const WEIGHT_CONTENT_TERM = 1;
const WEIGHT_TASK_VERB = 0.15;

/**
 * Light, predictable stemming. Deliberately conservative: prefix matching in the
 * ranker covers what this misses, so over-stemming is the worse failure mode.
 */
export function stem(word: string): string {
  const w = word.toLowerCase();
  // Deliberately does not undouble consonants: "billing" must stem to "bill",
  // not "bil". The prefix matcher in the ranker recovers "running"/"runn".
  if (w.length >= 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length >= 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length >= 5 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Split arbitrary text into normalized, stemmed terms. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  // Split on non-alphanumerics, then on camelCase / PascalCase boundaries so
  // BillingService indexes as "billing" + "service", not one opaque token.
  const pieces = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  for (const raw of pieces) {
    if (!raw || raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

/** Normalized term sequence used for phrase detection (stopwords kept out, order kept). */
export function phraseTokens(text: string): string[] {
  return tokenize(text);
}

export interface QueryTerm {
  term: string;
  weight: number;
  /** Task verbs do not count toward coverage. */
  counts: boolean;
}

export interface ParsedQuery {
  raw: string;
  terms: QueryTerm[];
  /** Distinct terms that represent the subject of the task. */
  contentTerms: string[];
  /** Adjacent content-term pairs, used for phrase scoring. */
  bigrams: string[][];
  /** Full normalized term sequence. */
  sequence: string[];
}

export function parseQuery(query: string): ParsedQuery {
  const rawWords = query
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const seen = new Map<string, QueryTerm>();
  const sequence: string[] = [];

  for (const word of rawWords) {
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    const isVerb = TASK_VERBS.has(word);
    const term = stem(word);
    sequence.push(term);
    const existing = seen.get(term);
    if (existing) {
      // A word appearing as both subject and verb is treated as subject.
      if (!isVerb && !existing.counts) {
        existing.counts = true;
        existing.weight = WEIGHT_CONTENT_TERM;
      }
      continue;
    }
    seen.set(term, {
      term,
      weight: isVerb ? WEIGHT_TASK_VERB : WEIGHT_CONTENT_TERM,
      counts: !isVerb,
    });
  }

  const terms = [...seen.values()];
  const contentTerms = terms.filter((t) => t.counts).map((t) => t.term);

  const bigrams: string[][] = [];
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = sequence[i];
    const b = sequence[i + 1];
    if (a && b) bigrams.push([a, b]);
  }

  return { raw: query, terms, contentTerms, bigrams, sequence };
}
