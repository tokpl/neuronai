import { join } from 'node:path';

import { createTeamBrain } from '@neuron-ai-memory/team-brain';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

function brain(runtime: NeuronRuntime) {
  return createTeamBrain({
    neuronDir: neuronDir(runtime),
    projectId: runtime.project.projectId,
    teamName: runtime.project.name,
  });
}

/** Shared team knowledge for a query (local scopes — no cloud). */
export async function handleTeamContext(
  runtime: NeuronRuntime,
  args: { query: string; actorId?: string },
) {
  try {
    const tb = brain(runtime);
    const result = await tb.teamContext(args.query, args.actorId);
    return okResult({
      markdown: result.markdown,
      actor: result.actor,
      hits: result.hits.map((h) => ({
        id: h.memory.id,
        scope: h.memory.scope,
        title: h.memory.title,
        status: h.memory.status,
        finalScore: h.finalScore,
        personalRelevance: h.personalRelevance,
        teamScore: h.teamScore,
        projectScore: h.projectScore,
      })),
      conflict: result.conflict,
      brain: {
        id: result.brain.id,
        name: result.brain.name,
        memberCount: result.brain.members.length,
        sharedCount: result.brain.sharedKnowledge.length,
      },
      note: result.note,
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Onboarding pack / New Developer Mode. */
export async function handleOnboarding(
  runtime: NeuronRuntime,
  args: { actorId?: string },
) {
  try {
    const tb = brain(runtime);
    const pack = await tb.onboarding(args.actorId);
    return okResult({
      markdown: pack.markdown,
      projectIntroduction: pack.projectIntroduction,
      architectureOverview: pack.architectureOverview,
      importantDecisions: pack.importantDecisions,
      commonMistakes: pack.commonMistakes,
      securityRules: pack.securityRules,
      codingRules: pack.securityRules,
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Decision timeline (legacy name). */
export async function handleDecisionHistory(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  return handleTeamDecisions(runtime, args);
}

/** Team decisions history (SharedMemory). */
export async function handleTeamDecisions(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const tb = brain(runtime);
    const decisions = await tb.teamDecisions(args.limit ?? 30);
    const timeline = await tb.engineeringTimeline(args.limit ?? 30);
    return okResult({
      decisions,
      timeline: timeline.events,
      timelineMarkdown: timeline.markdown,
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Team rules / standards. */
export async function handleTeamRules(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const tb = brain(runtime);
    const rules = await tb.teamRules(args.limit ?? 40);
    return okResult({
      rules,
      permissionModel: tb.permissionModel(),
      note: 'Approved PROJECT_RULE / PATTERN / SECURITY_RULE memories only.',
    });
  } catch (e) {
    return failResult(e);
  }
}

/** Who created / approved team knowledge. */
export async function handleContributors(
  runtime: NeuronRuntime,
  args: { limit?: number },
) {
  try {
    const tb = brain(runtime);
    await tb.load();
    const contributors = await tb.getTeamMemory().contributors(args.limit ?? 20);
    const audit = tb.recentAudit(20);
    return okResult({ contributors, recentAudit: audit });
  } catch (e) {
    return failResult(e);
  }
}
