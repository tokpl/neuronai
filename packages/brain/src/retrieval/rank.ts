import { conceptsFor, termsForConcept } from './concepts.js';
import { classifyIntent, intentAffinity, type QueryIntent } from './intent.js';
import { locationQueryBoost, locationRoleBoost } from './roles.js';
import { parseQuery, tokenize, type ParsedQuery } from './tokenize.js';
import type { ProjectMapEntry } from '../models.js';

/**
 * Deterministic lexical retrieval (BM25F-style) for the Project Brain.
 *
 * Design rule: relevance is a *gate*, not a term. Importance and freshness can only
 * reorder memories that already match the task — they can never promote an
 * unrelated memory above a relevant one.
 */

export type RetrievalKind =
  | 'decision'
  | 'pattern'
  | 'warning'
  | 'knowledge'
  | 'rule'
  | 'context'
  | 'insight'
  | 'location';

export interface RetrievalDoc {
  id: string;
  title: string;
  content: string;
  kind: RetrievalKind;
  tags?: string[];
  /** Underlying memory type when the doc came from the memory store. */
  type?: string;
  importance?: number;
  freshness?: number;
  confidence?: number;
  /** Set for `location` docs: the structured map entry behind this result. */
  location?: ProjectMapEntry;
}

export interface RetrievalHit {
  doc: RetrievalDoc;
  /** Final ordering score. */
  score: number;
  /** Pure task relevance in 0..1, before secondary signals. */
  relevance: number;
  /** Fraction of subject terms in the query that this doc matched. */
  coverage: number;
  matchedTerms: string[];
  /** Short human explanation — safe to show a user, never sent to the LLM prompt. */
  why: string;
}

export interface RetrievalStats {
  candidates: number;
  matched: number;
  returned: number;
  discarded: number;
  durationMs: number;
  contentTerms: string[];
  /** Canonical concepts the query was expanded with (billing, auth, …). */
  concepts: string[];
  intent: QueryIntent;
  /** Score below which candidates were dropped. */
  floor: number;
}

export interface RetrievalResult {
  hits: RetrievalHit[];
  stats: RetrievalStats;
  query: ParsedQuery;
}

export interface RetrievalOptions {
  limit?: number;
  /** Absolute relevance floor in 0..1. */
  minRelevance?: number;
  /** Drop hits scoring below this fraction of the best hit. */
  relativeFloor?: number;
  /** Restrict to specific kinds. */
  kinds?: RetrievalKind[];
}

const FIELD_WEIGHTS = { title: 3, tags: 2, content: 1 } as const;
const K1 = 1.2;
const B = 0.55;
const PREFIX_CREDIT = 0.6;
const MIN_PREFIX_LEN = 3;
/** A prefix match may not be much longer than the term it matched. */
const MAX_PREFIX_RATIO = 1.45;
const SATURATION = 1.8;

/**
 * A project brain holds tens of memories, not millions of documents. At that size
 * raw IDF punishes exactly the terms that matter most — the project's own domain
 * words appear in many memories *because* they are central. Floor it.
 */
const MIN_IDF = 0.35;

const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_RELEVANCE = 0.06;
const DEFAULT_RELATIVE_FLOOR = 0.25;

/**
 * Weight for terms the query did not contain but that share a concept with it —
 * how "stripe" reaches the billing module. Deliberately below a literal match.
 */
const CONCEPT_TERM_WEIGHT = 0.55;

interface DocIndex {
  doc: RetrievalDoc;
  fields: { title: string[]; tags: string[]; content: string[] };
  titleText: string;
  contentText: string;
  weightedLength: number;
}

function buildIndex(docs: RetrievalDoc[]): DocIndex[] {
  return docs.map((doc) => {
    const title = tokenize(doc.title);
    const tags = tokenize((doc.tags ?? []).join(' '));
    const content = tokenize(doc.content);
    return {
      doc,
      fields: { title, tags, content },
      titleText: doc.title.toLowerCase(),
      contentText: doc.content.toLowerCase(),
      weightedLength:
        title.length * FIELD_WEIGHTS.title +
        tags.length * FIELD_WEIGHTS.tags +
        content.length * FIELD_WEIGHTS.content,
    };
  });
}

/**
 * Occurrences of `term` in `tokens`, giving partial credit to prefix matches.
 * The length ratio guard keeps this to inflection recovery ("handl"/"handler")
 * and stops unrelated compounds matching ("project" is not "projectbrain").
 */
function countTerm(tokens: string[], term: string): number {
  let count = 0;
  for (const token of tokens) {
    if (token === term) {
      count += 1;
      continue;
    }
    if (term.length < MIN_PREFIX_LEN || token.length < MIN_PREFIX_LEN) continue;
    const [shorter, longer] = term.length <= token.length ? [term, token] : [token, term];
    if (longer.startsWith(shorter) && longer.length <= shorter.length * MAX_PREFIX_RATIO) {
      count += PREFIX_CREDIT;
    }
  }
  return count;
}

/** True when the ordered term sequence appears contiguously in the token list. */
function hasSequence(tokens: string[], sequence: string[]): boolean {
  if (sequence.length === 0 || sequence.length > tokens.length) return false;
  outer: for (let i = 0; i <= tokens.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (tokens[i + j] !== sequence[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Nudges memory kinds that match the shape of the task.
 * Small on purpose: it breaks ties, it does not decide relevance.
 */
function typeAffinity(query: string, doc: RetrievalDoc): number {
  const q = query.toLowerCase();
  const kind = doc.kind;
  const type = doc.type ?? '';
  let bonus = 0;
  if (/\b(architect|architecture|refactor|design|structure|decide|decision|adr)\w*/.test(q)) {
    if (kind === 'decision' || type === 'architecture_decision') bonus += 0.12;
  }
  if (/\b(bug|fix|broken|error|fail|failing|regression|issue|crash)\w*/.test(q)) {
    if (kind === 'warning' || type === 'mistake') bonus += 0.15;
  }
  if (/\b(pattern|convention|style|idiom|standard)\w*/.test(q)) {
    if (kind === 'pattern' || type === 'pattern') bonus += 0.1;
  }
  if (/\b(rule|rules|constraint|avoid|must not|never|convention|should)\b/.test(q)) {
    if (kind === 'rule' || type === 'business_rule') bonus += 0.28;
  }
  // Modification / feature work: keep project rules competitive with locations.
  if (/\b(add|implement|change|fix|refactor|endpoint|payment|invoice|stripe|auth)\b/.test(q)) {
    if (kind === 'rule' || type === 'business_rule') bonus += 0.12;
    if (kind === 'decision' || type === 'architecture_decision') bonus += 0.1;
  }
  if (kind === 'rule') bonus += 0.05;
  return bonus;
}

/**
 * Prefer real implementation surfaces over satellite folders that only share a
 * domain prefix (billing-ui, billing-admin, docs/billing).
 *
 * Applied *after* the multiplicative score so a strong literal prefix match
 * cannot outrank core services just by sharing the word "billing".
 */
function locationScoreBoost(query: string, doc: RetrievalDoc): number {
  const loc = doc.location;
  if (!loc) return 0;
  return locationRoleBoost(loc) + locationQueryBoost(query, loc);
}

export function retrieve(
  query: string,
  docs: RetrievalDoc[],
  options: RetrievalOptions = {},
): RetrievalResult {
  const started = Date.now();
  const parsed = parseQuery(query);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minRelevance = options.minRelevance ?? DEFAULT_MIN_RELEVANCE;
  const relativeFloor = options.relativeFloor ?? DEFAULT_RELATIVE_FLOOR;
  const intent = classifyIntent(query);

  // Expand the query along the concept lexicon so "stripe" can reach the billing
  // module (and "payment" can reach Stripe rules). Related lexicon terms are
  // added at CONCEPT_TERM_WEIGHT; concept keys are stemmed like document tags.
  const literal = new Set(parsed.terms.map((t) => t.term));
  const concepts = conceptsFor(query);
  const conceptTerms: Array<{ term: string; weight: number; counts: false }> = [];
  const conceptSet = new Set<string>();
  for (const concept of concepts) {
    for (const raw of termsForConcept(concept)) {
      for (const term of tokenize(raw)) {
        if (literal.has(term) || conceptSet.has(term)) continue;
        conceptSet.add(term);
        conceptTerms.push({ term, weight: CONCEPT_TERM_WEIGHT, counts: false });
      }
    }
  }
  const allTerms = [...parsed.terms, ...conceptTerms];

  const pool = options.kinds ? docs.filter((d) => options.kinds?.includes(d.kind)) : docs;

  if (allTerms.length === 0 || pool.length === 0) {
    return {
      hits: [],
      query: parsed,
      stats: {
        candidates: pool.length,
        matched: 0,
        returned: 0,
        discarded: pool.length,
        durationMs: Date.now() - started,
        contentTerms: parsed.contentTerms,
        concepts,
        intent,
        floor: minRelevance,
      },
    };
  }

  const index = buildIndex(pool);
  const totalDocs = index.length;
  const avgLength =
    index.reduce((sum, entry) => sum + entry.weightedLength, 0) / Math.max(1, totalDocs) || 1;

  // Document frequency per query term (prefix matches included).
  const docFreq = new Map<string, number>();
  for (const { term } of allTerms) {
    let df = 0;
    for (const entry of index) {
      const present =
        countTerm(entry.fields.title, term) > 0 ||
        countTerm(entry.fields.tags, term) > 0 ||
        countTerm(entry.fields.content, term) > 0;
      if (present) df += 1;
    }
    docFreq.set(term, df);
  }

  const contentTermCount = Math.max(1, parsed.contentTerms.length);
  const querySequence = parsed.sequence;
  const rawQueryPhrase = parsed.raw.toLowerCase().trim();

  const scored: RetrievalHit[] = [];

  for (const entry of index) {
    let lexical = 0;
    const matched: string[] = [];
    let matchedContentTerms = 0;

    let matchedConcepts = 0;

    for (const { term, weight, counts } of allTerms) {
      const tf =
        countTerm(entry.fields.title, term) * FIELD_WEIGHTS.title +
        countTerm(entry.fields.tags, term) * FIELD_WEIGHTS.tags +
        countTerm(entry.fields.content, term) * FIELD_WEIGHTS.content;
      if (tf <= 0) continue;

      const df = docFreq.get(term) ?? 0;
      const idf = Math.max(MIN_IDF, Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5)));
      const saturated = tf / (tf + K1 * (1 - B + (B * entry.weightedLength) / avgLength));
      lexical += weight * idf * saturated;

      matched.push(term);
      if (counts) matchedContentTerms += 1;
      else if (conceptSet.has(term)) matchedConcepts += 1;
    }

    // A shared concept is enough to survive the gate, but a literal match is not
    // required to be present for it to count.
    if (matchedContentTerms === 0 && matchedConcepts === 0) continue;

    // Reward queries whose subject terms are broadly covered by this memory.
    // Concept-only hits (payment → stripe) get a floor so they are not crushed
    // below minRelevance before rules can surface.
    const coverage = matchedContentTerms / contentTermCount;
    const coverageFactor =
      matchedContentTerms > 0
        ? 0.35 + 0.65 * Math.pow(coverage, 0.75)
        : matchedConcepts > 0
          ? 0.55
          : 0;
    lexical *= coverageFactor;

    // Exact phrase and title signals.
    let phraseBonus = 0;
    let exactPhrase = false;
    if (rawQueryPhrase.length > 3) {
      if (entry.titleText.includes(rawQueryPhrase)) {
        phraseBonus += 2.5;
        exactPhrase = true;
      } else if (entry.contentText.includes(rawQueryPhrase)) {
        phraseBonus += 1.2;
        exactPhrase = true;
      }
    }
    if (!exactPhrase && querySequence.length > 1) {
      if (hasSequence(entry.fields.title, querySequence)) {
        phraseBonus += 2;
        exactPhrase = true;
      } else if (hasSequence(entry.fields.content, querySequence)) {
        phraseBonus += 1;
        exactPhrase = true;
      }
    }
    let adjacentHits = 0;
    for (const bigram of parsed.bigrams) {
      if (adjacentHits >= 3) break;
      if (hasSequence(entry.fields.title, bigram)) {
        phraseBonus += 0.6;
        adjacentHits += 1;
      } else if (hasSequence(entry.fields.content, bigram)) {
        phraseBonus += 0.3;
        adjacentHits += 1;
      }
    }

    const titleMatches = parsed.contentTerms.filter(
      (term) => countTerm(entry.fields.title, term) > 0,
    ).length;
    // Proportional, so a partial title hit still counts for something.
    const titleBonus =
      parsed.contentTerms.length > 0 ? 1.5 * (titleMatches / parsed.contentTerms.length) : 0;

    const lex = lexical + phraseBonus + titleBonus;
    const relevance = lex / (lex + SATURATION);

    if (relevance < minRelevance) continue;

    const importance = clamp01(entry.doc.importance ?? 0.5);
    const freshness = clamp01(entry.doc.freshness ?? 0.5);
    const confidence = clamp01(entry.doc.confidence ?? 0.7);
    const affinity = typeAffinity(parsed.raw, entry.doc) + intentAffinity(intent, entry.doc.kind);

    // Multiplicative: zero relevance can never be rescued by importance.
    let score =
      relevance * (1 + 0.18 * importance + 0.1 * freshness + 0.07 * confidence + affinity) +
      locationScoreBoost(parsed.raw, entry.doc);

    // Rule questions must surface constraints even when a location also matches.
    if (
      entry.doc.kind === 'rule' &&
      (intent === 'CONVENTION' || intent === 'MODIFICATION' || /\brules?\b/i.test(parsed.raw))
    ) {
      score += 0.35;
    }

    score = round(score);

    scored.push({
      doc: entry.doc,
      score: round(score),
      relevance: round(relevance),
      coverage: round(coverage),
      matchedTerms: matched,
      why: explainHit({
        matched,
        inTitle: titleMatches > 0,
        exactPhrase,
        adjacent: adjacentHits > 0,
        coverage,
        conceptHits: matched.filter((t) => conceptSet.has(t)),
        isLocation: entry.doc.kind === 'location',
      }),
    });
  }

  scored.sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id));

  // Once a strong match exists, weak matches are noise.
  const best = scored[0]?.score ?? 0;
  const cutoff = best * relativeFloor;
  const kept = scored.filter((hit) => hit.score >= cutoff);
  const hits = kept.slice(0, limit);

  return {
    hits,
    query: parsed,
    stats: {
      candidates: pool.length,
      matched: scored.length,
      returned: hits.length,
      discarded: pool.length - hits.length,
      durationMs: Date.now() - started,
      contentTerms: parsed.contentTerms,
      concepts,
      intent,
      floor: round(Math.max(minRelevance, cutoff)),
    },
  };
}

/** Every result must be able to say why it is here, in plain words. */
function explainHit(input: {
  matched: string[];
  inTitle: boolean;
  exactPhrase: boolean;
  adjacent: boolean;
  coverage: number;
  conceptHits: string[];
  isLocation: boolean;
}): string {
  const literal = input.matched.filter((t) => !input.conceptHits.includes(t));
  const parts: string[] = [];
  if (literal.length) parts.push(`matched ${literal.slice(0, 6).join(', ')}`);
  if (input.conceptHits.length) parts.push(`concept: ${input.conceptHits.join(', ')}`);
  if (input.isLocation) parts.push('known location');
  if (input.inTitle) parts.push('in title');
  if (input.exactPhrase) parts.push('exact phrase');
  else if (input.adjacent) parts.push('adjacent terms');
  parts.push(`${Math.round(input.coverage * 100)}% of task terms`);
  return parts.join(' · ');
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
