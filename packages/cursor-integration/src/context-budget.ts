/**
 * Context Budget Manager — caps how much Neuron context reaches Cursor.
 *
 * Never dump thousands of memories. Prefer a short, ranked briefing.
 */

export type CursorTaskSize = 'small' | 'standard' | 'large' | 'architecture';

export interface ContextBudgetProfile {
  taskSize: CursorTaskSize;
  /** Soft max tokens for assembled context */
  maxTokens: number;
  /** Max memory items (titles + short snippets) */
  maxItems: number;
  /** Max characters per memory snippet in briefing */
  snippetChars: number;
  description: string;
}

export interface BudgetCandidate {
  id: string;
  title: string;
  content: string;
  /** 0..1 combined relevance × importance */
  score: number;
  type?: string;
}

export interface BudgetSelection {
  profile: ContextBudgetProfile;
  selected: BudgetCandidate[];
  omitted: number;
  tokenEstimate: number;
  briefing: string;
  warnings: string[];
}

const PROFILES: Record<CursorTaskSize, ContextBudgetProfile> = {
  small: {
    taskSize: 'small',
    maxTokens: 2_000,
    maxItems: 5,
    snippetChars: 180,
    description: 'Small task — top 5 facts only',
  },
  standard: {
    taskSize: 'standard',
    maxTokens: 4_000,
    maxItems: 8,
    snippetChars: 220,
    description: 'Standard feature work',
  },
  large: {
    taskSize: 'large',
    maxTokens: 7_000,
    maxItems: 12,
    snippetChars: 280,
    description: 'Cross-cutting change',
  },
  architecture: {
    taskSize: 'architecture',
    maxTokens: 10_000,
    maxItems: 16,
    snippetChars: 320,
    description: 'Architecture / multi-module redesign',
  },
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function resolveTaskSize(input?: string | CursorTaskSize): CursorTaskSize {
  if (
    input === 'small' ||
    input === 'standard' ||
    input === 'large' ||
    input === 'architecture'
  ) {
    return input;
  }
  return 'standard';
}

export function getContextBudgetProfile(
  size?: string | CursorTaskSize,
): ContextBudgetProfile {
  return PROFILES[resolveTaskSize(size)];
}

/** Infer budget from free-text task description. */
export function inferTaskSize(task: string): CursorTaskSize {
  const t = task.toLowerCase();
  if (
    /\b(architect|redesign|migrate|rewrite|multi[- ]?tenant|platform)\b/.test(t)
  ) {
    return 'architecture';
  }
  if (/\b(refactor|overhaul|across|entire|system)\b/.test(t)) {
    return 'large';
  }
  if (/\b(typo|rename|fix|lint|css|copy|one[- ]liner)\b/.test(t)) {
    return 'small';
  }
  return 'standard';
}

export class ContextBudgetManager {
  select(
    candidates: BudgetCandidate[],
    size?: CursorTaskSize | string,
  ): BudgetSelection {
    const profile = getContextBudgetProfile(size);
    const ranked = [...candidates].sort((a, b) => b.score - a.score);
    const selected: BudgetCandidate[] = [];
    let tokens = 0;
    const warnings: string[] = [];

    for (const c of ranked) {
      if (selected.length >= profile.maxItems) break;
      const snippet = truncate(c.content, profile.snippetChars);
      const cost = estimateTokens(`${c.title}\n${snippet}`);
      if (tokens + cost > profile.maxTokens) {
        warnings.push('Token budget reached; lower-ranked memories omitted');
        break;
      }
      selected.push({ ...c, content: snippet });
      tokens += cost;
    }

    const omitted = Math.max(0, ranked.length - selected.length);
    if (omitted > 0 && !warnings.length) {
      warnings.push(`Omitted ${omitted} lower-ranked memories (item cap)`);
    }

    const briefing = [
      `Context budget: ${profile.taskSize} (≤${profile.maxTokens} tokens, ≤${profile.maxItems} items)`,
      profile.description,
      '',
      '## Top context for this task',
      ...selected.map(
        (s, i) =>
          `${i + 1}. [${s.score.toFixed(2)}] ${s.title}${s.type ? ` (${s.type})` : ''}\n   ${s.content}`,
      ),
      '',
      'Never ask for “all memories”. Use neuron_search_memory for specifics.',
    ].join('\n');

    return {
      profile,
      selected,
      omitted,
      tokenEstimate: tokens,
      briefing,
      warnings,
    };
  }
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function createContextBudgetManager(): ContextBudgetManager {
  return new ContextBudgetManager();
}
