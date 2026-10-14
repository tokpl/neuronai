import type { ProjectBrain } from '../project-brain.js';
import { getImpact } from '../code/queries.js';
import type { DeliverPlaybook, WorkflowBoard } from '../models.js';
import { WorkflowBoardError } from './board-validate.js';

export interface ProposeWavesInput {
  goal: string;
  playbook?: DeliverPlaybook;
  /** Seed path/symbol from Brain recommendation or map. */
  seedPath?: string;
  /**
   * When Brain has code intelligence, refuse generic template waves without a
   * resolvable seed (forces grounded decompose).
   */
  requireCode?: boolean;
}

export type ProposedWave = WorkflowBoard['waves'][number];

export type ProposeQuality = 'code' | 'map' | 'generic';

/**
 * Propose dependency-ordered deliver waves from knowledge.code (+ map fallback).
 */
export function proposeDeliverWaves(
  brain: ProjectBrain,
  input: ProposeWavesInput,
): {
  waves: ProposedWave[];
  seedPath: string | null;
  usedCode: boolean;
  quality: ProposeQuality;
} {
  const playbook = input.playbook ?? 'build';
  const code = brain.getCode();
  const hasCodeGraph = Boolean(code?.files?.length || code?.symbols?.length || code?.edges?.length);

  let seed =
    input.seedPath?.trim() ||
    brain.getMap().entries?.find((e) => e.kind === 'module')?.path ||
    null;

  // Resolve seed against code paths when possible
  if (seed && code?.files?.length) {
    const hit = code.files.find(
      (f) => f.path === seed || f.path.endsWith(seed!) || seed!.endsWith(f.path),
    );
    if (hit) seed = hit.path;
  }

  const impact = seed ? getImpact(code, seed) : undefined;
  const usedCode = Boolean(impact);
  const requireCode = input.requireCode ?? hasCodeGraph;

  if (requireCode && hasCodeGraph && !usedCode) {
    throw new WorkflowBoardError(
      'PROPOSE_NEEDS_CODE',
      'propose_waves refused: Project Brain has code intelligence but seedPath did not resolve via getImpact. Pass a real module/file path from neuron_context recommendation or map.',
    );
  }

  const quality: ProposeQuality = usedCode ? 'code' : seed ? 'map' : 'generic';

  const implementPaths = impact
    ? [
        impact.target.path,
        ...impact.relatedFiles.filter((p) => p !== impact.target.path),
        ...impact.dependencies.map((d) => d.path),
      ]
        .filter((p, i, a) => a.indexOf(p) === i)
        .slice(0, 10)
    : seed
      ? [seed]
      : [];

  const dependentPaths = impact?.dependents?.map((d) => d.path).slice(0, 6) ?? [];
  const testPaths = impact?.relatedTests?.slice(0, 4) ?? [];
  const scripts = brain.prefs?.workflow?.scripts ?? {};

  const waves: ProposedWave[] = [];

  if (playbook === 'docs') {
    waves.push({
      id: 'w1',
      title: 'Draft docs from Brain',
      status: 'pending',
      paths: implementPaths.slice(0, 4),
      tasks: [
        `Write docs for: ${input.goal}`,
        'Cite brainRefs / opened paths for every claim',
        'Pick Diátaxis type explicitly',
      ],
    });
    waves.push({
      id: 'w2',
      title: 'Verify claims against source',
      status: 'pending',
      dependsOn: ['w1'],
      paths: implementPaths.slice(0, 4),
      tasks: ['Re-read cited paths', 'Remove invented APIs', 'Flag outdated statements'],
    });
  } else if (playbook === 'polish') {
    waves.push({
      id: 'w1',
      title: 'Simplify working diff',
      status: 'pending',
      paths: implementPaths.slice(0, 6),
      tasks: [
        `Polish: ${input.goal}`,
        'No scope expansion',
        'Hold low-value churn',
        'Reduce nesting where touched',
      ],
    });
    waves.push({
      id: 'w2',
      title: 'Verify',
      status: 'pending',
      dependsOn: ['w1'],
      paths: testPaths,
      tasks: scriptTasks(scripts),
    });
  } else if (playbook === 'maintain') {
    waves.push({
      id: 'w1',
      title: 'Maintain wave (one family)',
      status: 'pending',
      paths: implementPaths.slice(0, 6),
      tasks: [
        `Maintain: ${input.goal}`,
        'One family only (deps|harden|trim|stabilize)',
        'No silent majors — changelog gate',
        'Regenerate lockfile if deps changed',
      ],
    });
    waves.push({
      id: 'w2',
      title: 'Verify',
      status: 'pending',
      dependsOn: ['w1'],
      paths: testPaths,
      tasks: scriptTasks(scripts),
    });
  } else if (playbook === 'ui') {
    waves.push({
      id: 'w1',
      title: 'UI implement',
      status: 'pending',
      paths: implementPaths.slice(0, 6),
      tasks: [
        `UI: ${input.goal}`,
        'Project tokens / type scale only',
        'Semantic HTML + keyboard',
        'Avoid AI-default aesthetics',
      ],
    });
    waves.push({
      id: 'w2',
      title: 'A11y + responsive + motion',
      status: 'pending',
      dependsOn: ['w1'],
      paths: implementPaths.slice(0, 4),
      tasks: [
        'Contrast AA',
        'Desktop + mobile first viewport',
        '2–3 intentional motions max',
      ],
    });
    waves.push({
      id: 'w3',
      title: 'Verify scripts',
      status: 'pending',
      dependsOn: ['w2'],
      paths: testPaths,
      tasks: scriptTasks(scripts),
    });
  } else {
    waves.push({
      id: 'w1',
      title: 'Implement',
      status: 'pending',
      paths: implementPaths.length ? implementPaths : undefined,
      tasks: [
        `Implement: ${input.goal}`,
        seed ? `Start at ${seed}` : 'Ground paths from Brain map',
        usedCode ? 'Honor code-impact related files' : 'Prefer Brain map modules',
      ],
    });
    if (dependentPaths.length) {
      waves.push({
        id: 'w2',
        title: 'Update dependents',
        status: 'pending',
        dependsOn: ['w1'],
        paths: dependentPaths,
        tasks: dependentPaths.map((p) => `Review/update consumer ${p}`),
      });
    }
    const afterImpl = dependentPaths.length ? 'w2' : 'w1';
    if (testPaths.length || scripts.test) {
      waves.push({
        id: dependentPaths.length ? 'w3' : 'w2',
        title: 'Tests',
        status: 'pending',
        dependsOn: [afterImpl],
        paths: testPaths.length ? testPaths : undefined,
        tasks: testPaths.length
          ? testPaths.map((p) => `Update/extend ${p}`)
          : ['Add/adjust tests for the change'],
      });
      waves.push({
        id: dependentPaths.length ? 'w4' : 'w3',
        title: 'Verify',
        status: 'pending',
        dependsOn: [dependentPaths.length ? 'w3' : 'w2'],
        tasks: scriptTasks(scripts),
      });
    } else {
      waves.push({
        id: dependentPaths.length ? 'w3' : 'w2',
        title: 'Verify',
        status: 'pending',
        dependsOn: [afterImpl],
        tasks: scriptTasks(scripts),
      });
    }
  }

  return { waves, seedPath: seed, usedCode, quality };
}

function scriptTasks(scripts: {
  test?: string;
  lint?: string;
  typecheck?: string;
  build?: string;
}): string[] {
  const tasks: string[] = [];
  if (scripts.test) tasks.push(`Run \`${scripts.test}\``);
  if (scripts.lint) tasks.push(`Run \`${scripts.lint}\``);
  if (scripts.typecheck) tasks.push(`Run \`${scripts.typecheck}\``);
  if (scripts.build) tasks.push(`Run \`${scripts.build}\``);
  if (!tasks.length) tasks.push('Run project verify scripts from Brain prefs');
  return tasks;
}
