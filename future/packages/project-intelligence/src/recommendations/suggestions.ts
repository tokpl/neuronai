import type {
  FileChangeInsight,
  GitCommitInsight,
  MemorySuggestion,
  ArchitectureDriftFinding,
} from '../types.js';
import { newId } from '../types.js';

/**
 * Propose memories / cursor rules after important changes — never auto-save.
 */
export class MemorySuggestionEngine {
  fromFileChange(insight: FileChangeInsight, eventId?: string): MemorySuggestion[] {
    if (insight.importance === 'LOW') return [];
    const suggestions: MemorySuggestion[] = [];

    if (/payment/i.test(insight.summary) || insight.moduleHints.includes('Payment')) {
      suggestions.push({
        id: newId('sug'),
        kind: 'update',
        title: 'Payment module changed',
        content: `${insight.summary}. Affected: ${insight.affected.join(', ')}.`,
        confidence: 0.78,
        sourceEventId: eventId,
        requiresApproval: true,
      });
      if (/refund/i.test(insight.path) || /refund/i.test(insight.summary)) {
        suggestions.push({
          id: newId('sug'),
          kind: 'new_decision',
          title: 'Payments now support refunds',
          content: 'Decision candidate: payment refunds flow was introduced/changed. Confirm and store.',
          confidence: 0.82,
          sourceEventId: eventId,
          requiresApproval: true,
        });
        suggestions.push({
          id: newId('sug'),
          kind: 'new_pattern',
          title: 'Refunds use same transaction workflow',
          content: 'Pattern candidate: refunds should reuse the existing transaction/outbox workflow.',
          confidence: 0.8,
          sourceEventId: eventId,
          requiresApproval: true,
        });
      }
    }

    if (/auth/i.test(insight.summary)) {
      suggestions.push({
        id: newId('sug'),
        kind: 'update',
        title: 'Authentication module changed',
        content: `${insight.why} Affected: ${insight.affected.join(', ')}.`,
        confidence: 0.8,
        sourceEventId: eventId,
        requiresApproval: true,
      });
    }

    if (insight.importance === 'HIGH' && !suggestions.length) {
      suggestions.push({
        id: newId('sug'),
        kind: 'update',
        title: insight.summary,
        content: `${insight.why} Modules: ${insight.moduleHints.join(', ') || 'n/a'}.`,
        confidence: 0.7,
        sourceEventId: eventId,
        requiresApproval: true,
      });
    }

    return suggestions;
  }

  fromGit(insight: GitCommitInsight, eventId?: string): MemorySuggestion[] {
    if (insight.importance === 'LOW') return [];
    const out: MemorySuggestion[] = [];
    if (/refund/i.test(insight.message)) {
      out.push({
        id: newId('sug'),
        kind: 'new_decision',
        title: 'Payments now support refunds',
        content: `From commit: "${insight.message}". Related: ${insight.related.join(', ')}.`,
        confidence: 0.85,
        sourceEventId: eventId,
        requiresApproval: true,
      });
    }
    if (insight.suggestion) {
      out.push({
        id: newId('sug'),
        kind: 'update',
        title: `Memory from commit: ${insight.message.slice(0, 60)}`,
        content: `${insight.suggestion} Modules: ${insight.changedModules.join(', ')}.`,
        confidence: 0.75,
        sourceEventId: eventId,
        requiresApproval: true,
      });
    }
    return out;
  }

  fromDrift(finding: ArchitectureDriftFinding): MemorySuggestion[] {
    return [
      {
        id: newId('sug'),
        kind: 'cursor_rule',
        title: 'Detected architecture drift — generate Cursor rule?',
        content: `${finding.message} Evidence: ${finding.evidence}. Neuron will not auto-write rules.`,
        confidence: 0.77,
        requiresApproval: true,
      },
    ];
  }
}

export function createMemorySuggestionEngine(): MemorySuggestionEngine {
  return new MemorySuggestionEngine();
}
