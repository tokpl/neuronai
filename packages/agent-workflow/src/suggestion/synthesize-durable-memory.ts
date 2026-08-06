import type { MemoryType } from '@neuronai/types';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export interface DurableMemoryDraft {
  title: string;
  /** Multi-line durable prose stored in Project Brain and shown before confirmation */
  content: string;
  /** User-facing section heading (includes brain emoji) */
  sectionHeading: string;
}

const SECTION_BY_TYPE: Record<MemoryType, string> = {
  architecture_decision: '🧠 Architecture decision to remember',
  pattern: '🧠 Project pattern to remember',
  mistake: '🧠 Warning to remember',
  dependency: '🧠 Dependency decision to remember',
  business_rule: '🧠 Business rule to remember',
  knowledge: '🧠 Project knowledge to remember',
  context: '🧠 Project knowledge to remember',
};

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split(/\r?\n/)[0]?.trim();
  return line || undefined;
}

function ensureSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function ownershipLine(modules: string[]): string | undefined {
  if (modules.length === 0) return undefined;
  const focus = modules.slice(0, 3).join(', ');
  if (modules.length === 1) {
    return `Canonical: ${focus} owns this change — extend there first.`;
  }
  return `Canonical: primary ownership spans ${focus}.`;
}

/** Soft extract of what was replaced/retired from the human decision text. */
function replacedLine(blob: string): string | undefined {
  const replace =
    blob.match(
      /\b(?:replace[sd]?|retir(?:e|ed|ing)|deprecat(?:e|ed|ing)|remov(?:e|ed|ing)|migrat(?:e|ed|ing)\s+(?:away\s+from|off))\s+([^.;,\n]+)/i,
    ) ?? null;
  if (!replace?.[1]) return undefined;
  const target = replace[1].replace(/\s+/g, ' ').trim();
  if (target.length < 3 || target.length > 120) return undefined;
  return `Replaces: ${ensureSentence(target)}`;
}

function whyLine(type: MemoryType, analysis: CodeChangeAnalysis): string {
  switch (type) {
    case 'architecture_decision':
      return 'Why: future work should extend this architecture rather than reintroduce the previous approach.';
    case 'dependency':
      return 'Why: keep dependency choices consistent unless this decision is explicitly revisited.';
    case 'mistake':
      return 'Why: avoid repeating this failure mode in related changes.';
    case 'pattern':
      return 'Why: prefer this established pattern over reinventing the same structure.';
    case 'business_rule':
      return 'Why: keep this rule consistent across features.';
    default:
      if (analysis.hasAuthChange) {
        return 'Why: auth is a high-impact boundary — treat the current approach as source of truth.';
      }
      if (analysis.hasSchemaChange) {
        return 'Why: schema changes constrain storage and migrations for later work.';
      }
      return 'Why: future coding agents should use this instead of rediscovering it.';
  }
}

function decisionSentence(input: {
  commitMessage?: string;
  task?: string;
  analysis: CodeChangeAnalysis;
  type: MemoryType;
}): string {
  const fromCommit = firstLine(input.commitMessage);
  if (fromCommit) return ensureSentence(fromCommit);

  const fromTask = firstLine(input.task);
  if (fromTask && fromTask.toLowerCase() !== 'untitled task') {
    return ensureSentence(fromTask);
  }

  const summary = input.analysis.summary.trim();
  if (summary && summary !== 'Code changes detected') {
    return ensureSentence(summary);
  }

  if (input.type === 'dependency') {
    return 'Project dependencies changed in a lasting way.';
  }
  return 'A durable project change was recorded.';
}

/**
 * Turn change analysis into durable Project Brain prose.
 * Omits diffs, file lists, test/build output, and changelog-style metadata.
 */
export function synthesizeDurableMemory(input: {
  type: MemoryType;
  analysis: CodeChangeAnalysis;
  commitMessage?: string;
  task?: string;
}): DurableMemoryDraft {
  const title =
    firstLine(input.commitMessage) ||
    firstLine(input.task)?.slice(0, 80) ||
    input.analysis.summary;

  const decision = decisionSentence(input);
  const blob = [input.commitMessage, input.task, input.analysis.summary]
    .filter(Boolean)
    .join('\n');
  const replaced = replacedLine(blob);
  const ownership = ownershipLine(input.analysis.modules);
  const why = whyLine(input.type, input.analysis);

  // Readable block for AskQuestion + Project Brain storage (not a changelog).
  const lines = [decision];
  if (ownership) lines.push(ownership);
  if (replaced) lines.push(replaced);
  lines.push(why);

  return {
    title,
    content: lines.join('\n\n'),
    sectionHeading: SECTION_BY_TYPE[input.type] ?? '🧠 Project knowledge to remember',
  };
}

export function confirmationQuestionForType(type: MemoryType): string {
  switch (type) {
    case 'architecture_decision':
      return 'Should I remember this architecture decision for the project?';
    case 'dependency':
      return 'Should I remember this dependency decision for the project?';
    case 'mistake':
      return 'Should I remember this warning for the project?';
    case 'pattern':
      return 'Should I remember this project pattern?';
    case 'business_rule':
      return 'Should I remember this business rule for the project?';
    default:
      return 'Should I remember this for the project?';
  }
}
