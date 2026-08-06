import type { MemoryType } from '@neuronai/types';

import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export interface DurableMemoryDraft {
  title: string;
  content: string;
  /** User-facing section heading shown before the Yes/Edit/No question */
  sectionHeading: string;
}

const SECTION_BY_TYPE: Record<MemoryType, string> = {
  architecture_decision: 'Architecture decision to remember',
  pattern: 'Project pattern to remember',
  mistake: 'Warning to remember',
  dependency: 'Dependency decision to remember',
  business_rule: 'Business rule to remember',
  knowledge: 'Project knowledge to remember',
  context: 'Project knowledge to remember',
};

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split(/\r?\n/)[0]?.trim();
  return line || undefined;
}

function ownershipClause(modules: string[]): string | undefined {
  if (modules.length === 0) return undefined;
  const focus = modules.slice(0, 3).join(', ');
  if (modules.length === 1) {
    return `Canonical ownership sits in ${focus}.`;
  }
  return `Primary ownership spans ${focus}.`;
}

function whyClause(type: MemoryType, analysis: CodeChangeAnalysis): string {
  switch (type) {
    case 'architecture_decision':
      return 'Why: future work should extend this architecture rather than reintroduce the previous approach.';
    case 'dependency':
      return 'Why: future dependency choices should respect this decision unless it is explicitly revisited.';
    case 'mistake':
      return 'Why: avoid repeating this failure mode in related changes.';
    case 'pattern':
      return 'Why: prefer this established pattern over reinventing the same structure.';
    case 'business_rule':
      return 'Why: implementers must keep this rule consistent across features.';
    default:
      if (analysis.hasAuthChange) {
        return 'Why: auth is a high-impact boundary; treat the current approach as the source of truth.';
      }
      if (analysis.hasSchemaChange) {
        return 'Why: schema changes constrain storage and migrations for later work.';
      }
      return 'Why: future coding agents should use this as project knowledge instead of rediscovering it.';
  }
}

function decisionSentence(input: {
  commitMessage?: string;
  task?: string;
  analysis: CodeChangeAnalysis;
  type: MemoryType;
}): string {
  const fromCommit = firstLine(input.commitMessage);
  if (fromCommit) {
    // Prefer the human decision statement; normalize trailing punctuation lightly.
    return /[.!?]$/.test(fromCommit) ? fromCommit : `${fromCommit}.`;
  }

  const fromTask = firstLine(input.task);
  if (fromTask && fromTask.toLowerCase() !== 'untitled task') {
    return /[.!?]$/.test(fromTask) ? fromTask : `${fromTask}.`;
  }

  // Fall back to analyzer summary — already durable-ish, not a file dump.
  const summary = input.analysis.summary.trim();
  if (summary && summary !== 'Code changes detected') {
    return /[.!?]$/.test(summary) ? summary : `${summary}.`;
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
  const ownership = ownershipClause(input.analysis.modules);
  const why = whyClause(input.type, input.analysis);

  const parts = [decision];
  if (ownership) parts.push(ownership);
  parts.push(why);

  // Keep 2–5 short sentences; join with spaces for a readable paragraph block.
  const content = parts.join(' ').replace(/\s+/g, ' ').trim();

  return {
    title,
    content,
    sectionHeading: SECTION_BY_TYPE[input.type] ?? 'Project knowledge to remember',
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
