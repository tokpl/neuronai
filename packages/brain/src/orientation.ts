import type { QueryIntent } from './retrieval/intent.js';
import type { ModificationAdvice } from './retrieval/recommend.js';
import type { RelevantLocation } from './context.js';

/** Agency Onboarding Engineer shape — Brain-backed, no separate agent skill. */
export interface OrientationMap {
  oneLiner: string;
  fiveMinute: {
    primaryTasks: string;
    primaryInputs: string;
    primaryOutputs: string;
    keyFiles: string[];
    mainPaths: string[];
  };
  deepDive: {
    entryPoints: string[];
    flow: string[];
    filesInspected: string[];
  };
}

export function shouldEmitOrientation(input: {
  mode?: string;
  intent: QueryIntent;
  task: string;
  recommendation?: ModificationAdvice;
}): boolean {
  if (input.mode === 'deep') return true;
  if (input.intent === 'GENERAL_PROJECT') return true;
  return /\b(how (does|do)|where (is|are|should)|onboard|orient|explain (the )?(codebase|repo|project))\b/i.test(
    input.task,
  );
}

export function buildOrientationMap(input: {
  task: string;
  intent: QueryIntent;
  recommendation?: ModificationAdvice;
  relevantFiles: RelevantLocation[];
  relevantModules: RelevantLocation[];
  projectName?: string;
}): OrientationMap {
  const keyFiles = [
    ...(input.recommendation?.path ? [input.recommendation.path] : []),
    ...input.relevantFiles.map((f) => f.path),
    ...input.relevantModules.map((m) => m.path),
  ]
    .filter((p, i, a) => Boolean(p) && a.indexOf(p) === i)
    .slice(0, 8);

  const flow =
    input.recommendation?.flow?.map((f) => f.label).filter(Boolean).slice(0, 6) ??
    [];
  const deps =
    input.recommendation?.dependencies?.map((d) => d.path).filter(Boolean).slice(0, 4) ?? [];
  const entryPoints = [
    input.recommendation?.path,
    ...input.relevantModules.slice(0, 3).map((m) => m.path),
  ].filter((p): p is string => Boolean(p));

  const name = input.projectName?.trim() || 'this project';
  const oneLiner = input.recommendation
    ? `${name}: start at ${input.recommendation.path} (${input.recommendation.reason}).`
    : `${name}: Brain ranked ${keyFiles.length || 'no'} path(s) for “${input.task.slice(0, 80)}”.`;

  return {
    oneLiner,
    fiveMinute: {
      primaryTasks: input.task.slice(0, 200),
      primaryInputs: 'Task text + Project Brain retrieval (decisions, map, code edges)',
      primaryOutputs: 'Ranked paths, rules, and (when present) a recommended start',
      keyFiles,
      mainPaths: flow.length ? flow : keyFiles.slice(0, 4),
    },
    deepDive: {
      entryPoints: entryPoints.length ? entryPoints : keyFiles.slice(0, 3),
      flow: flow.length
        ? flow
        : [
            ...keyFiles.slice(0, 2).map((p) => `Open ${p}`),
            ...deps.map((d) => `Depends on ${d}`),
          ].slice(0, 6),
      filesInspected: keyFiles,
    },
  };
}

/** Compact markdown for appending into context when orientation is emitted. */
export function formatOrientationMarkdown(map: OrientationMap): string {
  const keys = map.fiveMinute.keyFiles.map((p) => `\`${p}\``).join(', ') || '—';
  const flow = map.deepDive.flow.map((s) => `- ${s}`).join('\n') || '- —';
  return [
    '## Orientation Map',
    '',
    `**1-line:** ${map.oneLiner}`,
    '',
    '**5-minute:**',
    `- Tasks: ${map.fiveMinute.primaryTasks}`,
    `- Key files: ${keys}`,
    '',
    '**Deep dive (flows):**',
    flow,
  ].join('\n');
}
