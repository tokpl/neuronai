import type {
  ArchitectureDecisionRecord,
  ArchitectureProposal,
  RequirementAnalysis,
  RiskAnalysis,
} from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Propose an ADR — status always Pending approval until a human accepts.
 */
export class AdrGenerator {
  generate(
    requirement: RequirementAnalysis,
    proposal: ArchitectureProposal,
    risk: RiskAnalysis,
  ): ArchitectureDecisionRecord {
    const option = proposal.options.find((o) => o.id === proposal.recommendedOptionId);
    const decision =
      option?.title ??
      (/notif/i.test(requirement.feature)
        ? 'Use event-based notifications'
        : `Adopt: ${proposal.recommendation}`);

    const reason =
      option?.pros[0] != null
        ? `${option.pros[0]}. ${option.summary}`
        : 'Avoid tight coupling; reuse existing boundaries where possible.';

    return {
      id: newId('adr'),
      title: `ADR: ${requirement.feature}`,
      decision,
      reason:
        /notif|event/i.test(requirement.raw + decision)
          ? 'Avoid tight coupling between producers and notification channels.'
          : reason,
      status: 'Pending approval',
      alternatives: proposal.options
        .filter((o) => o.id !== proposal.recommendedOptionId)
        .map((o) => o.title),
      consequences: [
        `Risk level ${risk.level}: ${risk.reasons[0] ?? 'monitor impact'}`,
        'Update constitution/patterns only after human approval',
      ],
      createdAt: nowIso(),
    };
  }

  markdown(adr: ArchitectureDecisionRecord): string {
    return [
      `# ${adr.title}`,
      '',
      `Status: **${adr.status}**`,
      '',
      '## Decision',
      '',
      adr.decision,
      '',
      '## Reason',
      '',
      adr.reason,
      '',
      '## Alternatives',
      '',
      ...adr.alternatives.map((a) => `- ${a}`),
      '',
      '## Consequences',
      '',
      ...adr.consequences.map((c) => `- ${c}`),
      '',
      `_Generated ${adr.createdAt}. Neuron does not auto-accept ADRs._`,
    ].join('\n');
  }
}

export function createAdrGenerator(): AdrGenerator {
  return new AdrGenerator();
}
