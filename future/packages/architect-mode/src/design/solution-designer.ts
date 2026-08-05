import type {
  ArchitectureProposal,
  ProjectMemoryContext,
  RequirementAnalysis,
  SolutionOption,
} from '../types.js';

/**
 * Propose architecture options — does not choose permanently without user approval.
 */
export class SolutionDesigner {
  design(
    requirement: RequirementAnalysis,
    memory?: ProjectMemoryContext,
  ): ArchitectureProposal {
    const feature = requirement.feature;
    const existing = buildExisting(memory, requirement);
    const options = buildOptions(requirement, memory);
    const recommended = pickRecommendation(options, requirement, memory);

    return {
      understanding: `Request: "${requirement.raw}". Feature=${feature}; complexity=${requirement.complexity}; risk=${requirement.risk}. Affected: ${requirement.affected.join(', ')}.`,
      existingSystem: existing,
      options,
      recommendedOptionId: recommended.id,
      recommendation: `${recommended.title} — ${recommended.summary}`,
    };
  }
}

function buildExisting(
  memory: ProjectMemoryContext | undefined,
  req: RequirementAnalysis,
): string[] {
  const lines: string[] = [];
  for (const d of (memory?.decisions ?? []).slice(0, 6)) lines.push(`Decision: ${d}`);
  for (const p of (memory?.patterns ?? []).slice(0, 4)) lines.push(`Pattern: ${p}`);
  for (const m of (memory?.mistakes ?? []).slice(0, 3)) lines.push(`Mistake: ${m}`);
  for (const c of (memory?.constitution ?? []).slice(0, 3)) lines.push(`Constitution: ${c}`);
  if (!lines.length) {
    lines.push(`Modules likely involved: ${req.affected.join(', ')}`);
    lines.push('No prior Neuron decisions loaded — confirm against .neuron/architecture.md');
  }
  return lines;
}

function buildOptions(
  req: RequirementAnalysis,
  memory?: ProjectMemoryContext,
): SolutionOption[] {
  const hasModule = (memory?.modules ?? []).some((m) =>
    req.feature.toLowerCase().includes(m.toLowerCase()) ||
    req.affected.some((a) => a.toLowerCase().includes(m.toLowerCase())),
  );
  const domain = req.affected[0] ?? req.feature;

  const optionA: SolutionOption = {
    id: 'A',
    title: `Extend existing ${domain.toLowerCase()} module`,
    summary: `Reuse current ${domain} boundaries and patterns.`,
    pros: ['Reuse code', 'Faster delivery', 'Keeps one domain owner'],
    cons: ['Higher complexity in the module', 'Risk of god-module growth'],
  };

  const optionB: SolutionOption = {
    id: 'B',
    title: `Create separate ${req.feature} service`,
    summary: 'Isolate the new capability behind a dedicated service boundary.',
    pros: ['Isolation', 'Independent deploy/scale story', 'Clear ownership'],
    cons: ['More maintenance', 'Cross-service contracts', 'Higher ops cost'],
  };

  if (/marketplace/i.test(req.feature)) {
    optionA.title = 'Extend catalog + orders within the monorepo';
    optionB.title = 'Create a dedicated marketplace bounded context / service';
  }

  if (hasModule || /payment|auth/i.test(req.feature)) {
    optionA.pros.push('Aligns with existing Neuron module map');
  }

  return [optionA, optionB];
}

function pickRecommendation(
  options: SolutionOption[],
  req: RequirementAnalysis,
  memory?: ProjectMemoryContext,
): SolutionOption {
  const preferExtend =
    (memory?.patterns ?? []).some((p) => /service|module|reuse|existing/i.test(p)) ||
    req.complexity !== 'HIGH' ||
    /refund|extend|add to/i.test(req.raw);
  return preferExtend ? options[0]! : options[1]!;
}

export function createSolutionDesigner(): SolutionDesigner {
  return new SolutionDesigner();
}
