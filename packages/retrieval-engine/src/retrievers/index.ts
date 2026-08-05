import type { MemoryRecord } from '@neuron-ai-memory/types';

import type { AnalyzedQuery, RetrievalHit } from '../types.js';
import { clamp01 } from '../types.js';

export interface Retriever {
  readonly name: string;
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[];
}

export interface RetrievalContext {
  memories: MemoryRecord[];
  constitutionRules?: string[];
  fileNames?: string[];
  graphModules?: string[];
  gitSubjects?: string[];
  docSnippets?: Array<{ title: string; content: string }>;
}

function keywordScore(text: string, query: AnalyzedQuery): number {
  const hay = text.toLowerCase();
  let hits = 0;
  for (const kw of query.keywords) if (hay.includes(kw)) hits += 1;
  for (const d of query.domains) if (hay.includes(d)) hits += 1.5;
  for (const r of query.related) if (hay.includes(r)) hits += 1;
  return clamp01(hits / Math.max(4, query.keywords.length || 4));
}

/** Cheap gate: skip full scoring when no query token appears in haystack. */
function hasAnyToken(hay: string, query: AnalyzedQuery): boolean {
  for (const kw of query.keywords) if (hay.includes(kw)) return true;
  for (const d of query.domains) if (hay.includes(d)) return true;
  for (const r of query.related) if (hay.includes(r)) return true;
  return false;
}

function pushTopK(heap: RetrievalHit[], hit: RetrievalHit, k: number): void {
  if (heap.length < k) {
    heap.push(hit);
    return;
  }
  let minIdx = 0;
  for (let i = 1; i < heap.length; i++) {
    if ((heap[i]!.baseRelevance ?? 0) < (heap[minIdx]!.baseRelevance ?? 0)) minIdx = i;
  }
  if ((hit.baseRelevance ?? 0) > (heap[minIdx]!.baseRelevance ?? 0)) {
    heap[minIdx] = hit;
  }
}

export class MemoryRetriever implements Retriever {
  readonly name = 'memory';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const allowGeneral = query.domains[0] === 'general';
    const top: RetrievalHit[] = [];
    for (const m of ctx.memories) {
      if (m.status !== 'active') continue;
      const hay = `${m.title} ${m.content}`.toLowerCase();
      if (!allowGeneral && !hasAnyToken(hay, query)) continue;
      const baseRelevance = keywordScore(hay, query);
      if (baseRelevance <= 0.05 && !allowGeneral) continue;
      pushTopK(
        top,
        {
          id: `mem:${m.id}`,
          source: 'memory',
          title: m.title,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          baseRelevance,
          importance: m.importanceScore,
          confidence: m.confidenceScore,
          freshness: m.freshnessScore,
        },
        80,
      );
    }
    return top.sort((a, b) => (b.baseRelevance ?? 0) - (a.baseRelevance ?? 0));
  }
}

export class DecisionRetriever implements Retriever {
  readonly name = 'decision';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const top: RetrievalHit[] = [];
    const wantBroad = query.intent === 'ARCHITECTURE' || query.complexity === 'architecture';
    for (const m of ctx.memories) {
      if (m.status !== 'active' || m.type !== 'architecture_decision') continue;
      const hay = `${m.title} ${m.content}`.toLowerCase();
      const matched = hasAnyToken(hay, query);
      if (!matched && !wantBroad) continue;
      if (!matched && wantBroad && m.importanceScore < 0.7) continue;
      const baseRelevance = matched
        ? Math.max(0.35, keywordScore(hay, query))
        : 0.25 + m.importanceScore * 0.2;
      pushTopK(
        top,
        {
          id: `dec:${m.id}`,
          source: 'decision',
          title: m.title,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          baseRelevance,
          importance: Math.max(0.7, m.importanceScore),
          confidence: m.confidenceScore,
          freshness: m.freshnessScore,
        },
        40,
      );
    }
    return top.sort((a, b) => (b.baseRelevance ?? 0) - (a.baseRelevance ?? 0));
  }
}

/**
 * Temporal awareness layer: boost current stack decisions, demote superseded ones.
 * Complements ranking freshness (MySQL vs Postgres, REST vs GraphQL, etc.).
 */
export class TimeAwareRetriever implements Retriever {
  readonly name = 'time_aware';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const pairs: Array<{ old: RegExp; current: RegExp; label: string }> = [
      { old: /\bmysql\b/i, current: /\bpostgres/i, label: 'database' },
      { old: /\bmongodb\b/i, current: /\bpostgres/i, label: 'database' },
      { old: /\bredux\b/i, current: /\bzustand\b/i, label: 'state' },
      { old: /\brest\b/i, current: /\bgraphql\b/i, label: 'api' },
    ];
    const hits: RetrievalHit[] = [];
    for (const m of ctx.memories) {
      if (m.status !== 'active' || m.type !== 'architecture_decision') continue;
      const blob = `${m.title} ${m.content}`;
      for (const p of pairs) {
        if (!p.current.test(blob) && !p.old.test(blob)) continue;
        const isCurrent = p.current.test(blob);
        const isOld = p.old.test(blob) && !isCurrent;
        if (!isCurrent && !isOld) continue;
        hits.push({
          id: `time:${m.id}`,
          source: 'decision',
          title: m.title,
          content: isOld
            ? `${m.content}\n(Superseded ${p.label} decision — prefer newer stack.)`
            : `${m.content}\n(Current ${p.label} decision.)`,
          type: m.type,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          baseRelevance: isCurrent ? 0.65 : 0.25,
          importance: Math.max(0.75, m.importanceScore),
          confidence: m.confidenceScore,
          freshness: isCurrent ? Math.max(0.85, m.freshnessScore) : Math.min(0.35, m.freshnessScore),
          metadata: { temporal: isCurrent ? 'current' : 'superseded', topic: p.label },
        });
      }
      if (hits.length >= 30) break;
    }
    return hits;
  }
}


export class ConstitutionRetriever implements Retriever {
  readonly name = 'constitution';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    return (ctx.constitutionRules ?? []).map((rule, i) => ({
      id: `const:${i}`,
      source: 'constitution' as const,
      title: 'Constitution rule',
      content: rule,
      baseRelevance: Math.max(0.4, keywordScore(rule, query)),
      importance: 0.85,
      confidence: 0.9,
      freshness: 1,
    }));
  }
}

export class KnowledgeGraphRetriever implements Retriever {
  readonly name = 'knowledge_graph';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const modules = ctx.graphModules ?? [];
    return modules
      .filter((name) => {
        const n = name.toLowerCase();
        return (
          query.domains.some((d) => n.includes(d.slice(0, 4))) ||
          query.keywords.some((k) => n.includes(k))
        );
      })
      .slice(0, 20)
      .map((name, i) => ({
        id: `kg:${i}:${name}`,
        source: 'knowledge_graph' as const,
        title: `Module: ${name}`,
        content: `Related module/area from knowledge graph: ${name}`,
        baseRelevance: 0.55,
        importance: 0.5,
        confidence: 0.7,
        freshness: 0.8,
        metadata: { module: name },
      }));
  }
}

export class CodeRetriever implements Retriever {
  readonly name = 'code';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const files = ctx.fileNames ?? [];
    return files
      .filter((f) => {
        const n = f.toLowerCase();
        return query.keywords.some((k) => n.includes(k)) || query.domains.some((d) => n.includes(d));
      })
      .slice(0, 25)
      .map((f, i) => ({
        id: `code:${i}`,
        source: 'code' as const,
        title: f,
        content: `Related file/symbol: ${f}`,
        baseRelevance: 0.5,
        importance: 0.4,
        confidence: 0.6,
        freshness: 0.7,
        metadata: { path: f },
      }));
  }
}

export class GitHistoryRetriever implements Retriever {
  readonly name = 'git';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    return (ctx.gitSubjects ?? [])
      .filter((s) => keywordScore(s, query) > 0.1)
      .slice(0, 15)
      .map((s, i) => ({
        id: `git:${i}`,
        source: 'git' as const,
        title: 'Recent commit',
        content: s,
        baseRelevance: keywordScore(s, query),
        importance: 0.35,
        confidence: 0.5,
        freshness: 0.9,
      }));
  }
}

export class DocumentationRetriever implements Retriever {
  readonly name = 'documentation';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    return (ctx.docSnippets ?? [])
      .map((d, i) => ({
        id: `doc:${i}`,
        source: 'documentation' as const,
        title: d.title,
        content: d.content,
        baseRelevance: keywordScore(`${d.title} ${d.content}`, query),
        importance: 0.45,
        confidence: 0.65,
        freshness: 0.6,
      }))
      .filter((h) => (h.baseRelevance ?? 0) > 0.08);
  }
}

export class StyleRetriever implements Retriever {
  readonly name = 'style';
  retrieve(query: AnalyzedQuery, ctx: RetrievalContext): RetrievalHit[] {
    const hits: RetrievalHit[] = [];
    const files = ctx.fileNames ?? [];
    let zustandHint = files.some((f) => /zustand/i.test(f));
    const serviceCount = files.filter((f) => /Service\./i.test(f)).length;

    for (const m of ctx.memories) {
      if (m.type !== 'pattern' && m.type !== 'dependency') continue;
      const blob = `${m.title} ${m.content}`;
      if (!zustandHint && /zustand/i.test(blob)) zustandHint = true;
      if (/prefer|convention|naming|use .* over/i.test(blob)) {
        hits.push({
          id: `style:mem:${m.id}`,
          source: 'style',
          title: m.title,
          content: m.content,
          baseRelevance: keywordScore(blob, query) || 0.4,
          importance: m.importanceScore,
          confidence: m.confidenceScore,
          freshness: m.freshnessScore,
        });
      }
      if (hits.length >= 20 && zustandHint) break;
    }

    if (zustandHint) {
      hits.push({
        id: 'style:zustand',
        source: 'style',
        title: 'State management preference',
        content: 'Project prefers Zustand over Redux (detected from patterns/deps).',
        baseRelevance: query.domains.includes('frontend') ? 0.7 : 0.3,
        importance: 0.6,
        confidence: 0.7,
        freshness: 0.8,
      });
    }
    if (serviceCount >= 3) {
      hits.push({
        id: 'style:service',
        source: 'style',
        title: 'Service module style',
        content: 'Project prefers *Service modules for business logic.',
        baseRelevance: 0.55,
        importance: 0.65,
        confidence: 0.75,
        freshness: 0.85,
      });
    }
    return hits;
  }
}


export function defaultRetrievers(): Retriever[] {
  return [
    new MemoryRetriever(),
    new DecisionRetriever(),
    new TimeAwareRetriever(),
    new ConstitutionRetriever(),
    new KnowledgeGraphRetriever(),
    new CodeRetriever(),
    new GitHistoryRetriever(),
    new DocumentationRetriever(),
    new StyleRetriever(),
  ];
}
