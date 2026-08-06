import { tokenize } from './retrieval/tokenize.js';

/**
 * Content-level deduplication for project memory.
 *
 * Duplicates are merged, never dropped: the surviving record keeps the richest
 * content, the union of tags and the strongest scores, so no user knowledge is lost.
 */

export interface DedupableRecord {
  id: string;
  type: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  importanceScore?: number;
  confidenceScore?: number;
}

export type DuplicateReason = 'identical' | 'near-identical';

export interface DuplicateMatch<T extends DedupableRecord> {
  existing: T;
  reason: DuplicateReason;
  similarity: number;
}

/** Default Jaccard threshold above which two memories are the same knowledge. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable fingerprint of the knowledge a record carries (ignores formatting). */
export function contentFingerprint(record: {
  type: string;
  title: string;
  content: string;
}): string {
  return `${record.type}::${normalizeText(record.title)}::${normalizeText(record.content)}`;
}

function tokenSet(record: { title: string; content: string }): Set<string> {
  return new Set(tokenize(`${record.title} ${record.content}`));
}

/** Jaccard overlap of the meaningful terms in two records (0..1). */
export function similarity(
  a: { title: string; content: string },
  b: { title: string; content: string },
): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return setA.size === setB.size ? 1 : 0;
  let shared = 0;
  for (const term of setA) if (setB.has(term)) shared += 1;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * Find an existing record that already holds the same knowledge as `candidate`.
 * Only records of the same type are considered.
 */
export function findDuplicate<T extends DedupableRecord>(
  candidate: { type: string; title: string; content: string },
  existing: readonly T[],
  options: { threshold?: number } = {},
): DuplicateMatch<T> | null {
  const threshold = options.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const fingerprint = contentFingerprint(candidate);
  const candidateTitle = normalizeText(candidate.title);

  let titleMatch: DuplicateMatch<T> | null = null;
  let similarMatch: DuplicateMatch<T> | null = null;

  for (const record of existing) {
    if (record.type !== candidate.type) continue;

    if (contentFingerprint(record) === fingerprint) {
      return { existing: record, reason: 'identical', similarity: 1 };
    }

    // A memory's title is its identity: re-saving the same decision with a
    // reworded body must update it, not append a second copy.
    if (
      !titleMatch &&
      candidateTitle.length > 0 &&
      normalizeText(record.title) === candidateTitle
    ) {
      titleMatch = {
        existing: record,
        reason: 'near-identical',
        similarity: round(Math.max(similarity(candidate, record), 0.9)),
      };
      continue;
    }

    const score = similarity(candidate, record);
    if (score >= threshold && (!similarMatch || score > similarMatch.similarity)) {
      similarMatch = { existing: record, reason: 'near-identical', similarity: round(score) };
    }
  }

  return titleMatch ?? similarMatch;
}

/** Merge `incoming` into `existing`, keeping the richest version of every field. */
export function mergeRecords<T extends DedupableRecord>(existing: T, incoming: Partial<T>): T {
  const existingContent = existing.content ?? '';
  const incomingContent = incoming.content ?? '';
  const tags = [...new Set([...(existing.tags ?? []), ...(incoming.tags ?? [])])];

  return {
    ...existing,
    // Keep the more informative title/content rather than the most recent one.
    title: (incoming.title ?? '').length > existing.title.length ? incoming.title! : existing.title,
    content: incomingContent.length > existingContent.length ? incomingContent : existingContent,
    tags,
    importanceScore: Math.max(existing.importanceScore ?? 0, incoming.importanceScore ?? 0),
    confidenceScore: Math.max(existing.confidenceScore ?? 0, incoming.confidenceScore ?? 0),
    updatedAt: new Date().toISOString(),
  };
}

export interface DedupeMerge {
  keptId: string;
  mergedIds: string[];
  reason: DuplicateReason;
}

export interface DedupeResult<T extends DedupableRecord> {
  records: T[];
  merges: DedupeMerge[];
  removed: number;
}

/**
 * Collapse duplicates in an existing collection (migration path for brains that
 * accumulated repeats before write-time dedupe existed).
 */
export function dedupeRecords<T extends DedupableRecord>(
  records: readonly T[],
  options: { threshold?: number } = {},
): DedupeResult<T> {
  const kept: T[] = [];
  const merges = new Map<string, DedupeMerge>();

  for (const record of records) {
    const match = findDuplicate(record, kept, options);
    if (!match) {
      kept.push(record);
      continue;
    }
    const index = kept.findIndex((k) => k.id === match.existing.id);
    const merged = mergeRecords(match.existing, record);
    // Preserve the original creation time of the surviving record.
    kept[index] = { ...merged, createdAt: match.existing.createdAt ?? record.createdAt };

    const entry = merges.get(match.existing.id) ?? {
      keptId: match.existing.id,
      mergedIds: [],
      reason: match.reason,
    };
    entry.mergedIds.push(record.id);
    if (match.reason === 'near-identical') entry.reason = 'near-identical';
    merges.set(match.existing.id, entry);
  }

  return {
    records: kept,
    merges: [...merges.values()],
    removed: records.length - kept.length,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
