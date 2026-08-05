import type { RankedHit } from '../types.js';
import { estimateTokens } from '../types.js';

export interface CompressionResult {
  hits: RankedHit[];
  savedTokens: number;
  techniques: string[];
}

/**
 * Shrink context without inventing facts: dedupe, merge near-duplicates, trim.
 */
export class ContextCompressor {
  compress(hits: RankedHit[], maxTokens: number, snippetChars: number): CompressionResult {
    const techniques: string[] = [];
    let working = dedupe(hits);
    if (working.length < hits.length) techniques.push('deduplication');

    working = mergeSimilar(working);
    if (working.length < hits.length) techniques.push('merging');

    working = working.map((h) => ({
      ...h,
      content: priorityExtract(h.content, snippetChars),
    }));
    techniques.push('priority extraction');

    const before = hits.reduce((s, h) => s + estimateTokens(`${h.title}\n${h.content}`), 0);
    const selected: RankedHit[] = [];
    let tokens = 0;
    for (const h of working) {
      const cost = estimateTokens(`${h.title}\n${h.content}`);
      if (tokens + cost > maxTokens) {
        techniques.push('budget trim');
        break;
      }
      selected.push(h);
      tokens += cost;
    }

    // Light summarization: collapse long multi-line into first decision-like lines
    const summarized = selected.map((h) => ({
      ...h,
      content: summarizeLocal(h.content, snippetChars),
    }));
    if (summarized.some((h, i) => h.content !== selected[i]!.content)) {
      techniques.push('summarization');
    }

    const after = summarized.reduce((s, h) => s + estimateTokens(`${h.title}\n${h.content}`), 0);
    return {
      hits: summarized,
      savedTokens: Math.max(0, before - after),
      techniques: [...new Set(techniques)],
    };
  }
}

function dedupe(hits: RankedHit[]): RankedHit[] {
  const seen = new Set<string>();
  const out: RankedHit[] = [];
  for (const h of hits) {
    const key = `${h.title}|${h.content.slice(0, 80)}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function mergeSimilar(hits: RankedHit[]): RankedHit[] {
  const out: RankedHit[] = [];
  for (const h of hits) {
    const dup = out.find(
      (o) =>
        o.source === h.source &&
        jaccard(o.title, h.title) > 0.7 &&
        jaccard(o.content.slice(0, 120), h.content.slice(0, 120)) > 0.5,
    );
    if (dup) {
      if (h.finalScore > dup.finalScore) {
        const idx = out.indexOf(dup);
        out[idx] = h;
      }
      continue;
    }
    out.push(h);
  }
  return out;
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const sb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

function priorityExtract(text: string, max: number): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const priority = lines.filter((l) =>
    /decision|warning|do not|never|must|prefer|rule:/i.test(l),
  );
  const picked = (priority.length ? priority : lines).join(' ');
  return picked.length <= max ? picked : `${picked.slice(0, max - 1)}…`;
}

function summarizeLocal(text: string, max: number): string {
  if (text.length <= max) return text;
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? text;
  return sentence.length <= max ? `${sentence}.` : `${sentence.slice(0, max - 1)}…`;
}

export function createContextCompressor(): ContextCompressor {
  return new ContextCompressor();
}
