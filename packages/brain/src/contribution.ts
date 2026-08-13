import type { ContextEfficiency, RelevantLocation, RelevantRule } from './context.js';

/** Leading mark for every contribution footer (seedling = growing project knowledge). */
export const CONTRIBUTION_EMOJI = '🌱';

/**
 * Ready-to-print Neuron contribution for CLI / Cursor end-of-reply footers.
 * Numbers reuse ContextEfficiency — no second metrics engine.
 * `summary` is always non-empty and meant to be appended every time neuron_context was used.
 */
export interface ContextContribution {
  /** One block ready to append to a user-visible reply — always present. */
  summary: string;
  /** Short lines for richer CLI / multi-line footers. */
  lines: string[];
  brainCompressionTokens: number;
  contextTokens: number;
  budgetTokens: number;
  /** Knowledge items packed (excludes map/code locations; rules counted separately). */
  memoriesUsed: number;
  /** Matched knowledge left out of the pack — structured only, not in summary. */
  memoriesSkipped: number;
  /** Matched knowledge docs this turn (used + skipped + rules in pack). */
  memoriesInBrain: number;
  pathsSuggested: number;
  rulesApplied: number;
  /** Rounded compression ratio vs matched knowledge paste (e.g. 5.4). */
  compressionRatio: number;
  recommendationPath?: string;
  /** Present only when simulated rediscovery estimate is > 0. */
  rediscoveryTokensSimulated?: number;
  label: 'brain-compression';
}

/** Human token display shared by CLI and MCP contribution footers. */
export function formatContributionTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${n}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function formatRatio(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '1×';
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}×`;
}

/**
 * Build the UX contract for “what Neuron contributed this turn”.
 * Every number in the user-facing text carries a plain-language gloss.
 *
 * Prefer explicit knowledge counts from prepareContext — never derive "memories"
 * from compiler itemsSelected (that includes map/code locations).
 */
export function buildContextContribution(input: {
  efficiency: ContextEfficiency;
  relevantFiles: RelevantLocation[];
  relevantModules: RelevantLocation[];
  relevantRules: RelevantRule[];
  recommendationPath?: string;
  /** Packed non-rule knowledge items. Falls back to itemsSelected only for unit tests. */
  memoriesUsed?: number;
  memoriesSkipped?: number;
  memoriesInBrain?: number;
}): ContextContribution {
  const eff = input.efficiency;
  const pathsSuggested = input.relevantFiles.length + input.relevantModules.length;
  const rulesApplied = input.relevantRules.length;
  const memoriesUsed = Math.max(
    0,
    input.memoriesUsed ?? Math.max(0, eff.itemsSelected - rulesApplied),
  );
  const memoriesSkipped = Math.max(0, input.memoriesSkipped ?? eff.itemsDiscarded);
  const memoriesInBrain = Math.max(
    0,
    input.memoriesInBrain ?? memoriesUsed + rulesApplied + memoriesSkipped,
  );
  const brainCompressionTokens = Math.max(0, eff.estimatedTokensSaved);
  const compressionRatio = eff.compressionRatio > 0 ? eff.compressionRatio : 1;
  const rediscovery =
    eff.estimatedRediscoveryAvoided && eff.estimatedRediscoveryAvoided > 0
      ? eff.estimatedRediscoveryAvoided
      : undefined;

  const summaryLines = [
    `${CONTRIBUTION_EMOJI} Neuron · saved ~${formatContributionTokens(brainCompressionTokens)} tokens of context`,
    `Used ${memoriesUsed} ${plural(memoriesUsed, 'memory', 'memories')} from Project Brain`,
  ];

  if (pathsSuggested > 0 || rulesApplied > 0) {
    const bits: string[] = [];
    if (pathsSuggested > 0) {
      bits.push(
        `${pathsSuggested} ${plural(pathsSuggested, 'file/module path', 'file/module paths')}`,
      );
    }
    if (rulesApplied > 0) {
      bits.push(`${rulesApplied} ${plural(rulesApplied, 'project rule', 'project rules')}`);
    }
    summaryLines.push(`Pointed the agent to ${bits.join(' and ')}`);
  }

  if (compressionRatio >= 1.2) {
    summaryLines.push(
      `Context is ~${formatRatio(compressionRatio)} more compact than matched Project Brain knowledge`,
    );
  }

  if (rediscovery !== undefined) {
    summaryLines.push(
      `~${formatContributionTokens(rediscovery)} fewer tokens of structural rediscovery (simulated)`,
    );
  }

  summaryLines.push(`Ranked this context in ${eff.retrievalMs} ms`);

  const summary = summaryLines.join('\n');

  const lines: string[] = [
    `${CONTRIBUTION_EMOJI} Neuron helped this turn`,
    `Saved ~${formatContributionTokens(brainCompressionTokens)} tokens of context`,
    `Used ${memoriesUsed} ${plural(memoriesUsed, 'memory', 'memories')} from Project Brain`,
  ];
  if (pathsSuggested > 0 || rulesApplied > 0) {
    const bits: string[] = [];
    if (pathsSuggested > 0) {
      bits.push(
        `${pathsSuggested} ${plural(pathsSuggested, 'file/module path', 'file/module paths')}`,
      );
    }
    if (rulesApplied > 0) {
      bits.push(`${rulesApplied} ${plural(rulesApplied, 'project rule', 'project rules')}`);
    }
    lines.push(`Pointed the agent to ${bits.join(' and ')}`);
  } else {
    lines.push('No map paths in this pack — knowledge came from ranked memories');
  }
  if (compressionRatio >= 1.2) {
    lines.push(
      `Context is ~${formatRatio(compressionRatio)} more compact than matched Project Brain knowledge (${eff.contextTokens} / ${eff.budgetTokens} token budget)`,
    );
  } else {
    lines.push(`Packed into ${eff.contextTokens} / ${eff.budgetTokens} token budget`);
  }
  lines.push(`Ranked this context in ${eff.retrievalMs} ms`);
  if (input.recommendationPath) {
    lines.push(`Best start: ${input.recommendationPath}`);
  }
  if (rediscovery !== undefined) {
    lines.push(
      `~${formatContributionTokens(rediscovery)} fewer tokens of structural rediscovery (simulated)`,
    );
  }

  return {
    summary,
    lines,
    brainCompressionTokens,
    contextTokens: eff.contextTokens,
    budgetTokens: eff.budgetTokens,
    memoriesUsed,
    memoriesSkipped,
    memoriesInBrain,
    pathsSuggested,
    rulesApplied,
    compressionRatio,
    recommendationPath: input.recommendationPath,
    rediscoveryTokensSimulated: rediscovery,
    label: 'brain-compression',
  };
}
