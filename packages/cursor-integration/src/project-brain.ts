import { join } from 'node:path';

import { openProjectBrain } from '@neuronai/brain';

export interface ProjectBrainInput {
  projectId: string;
  projectName: string;
  stack?: string[];
  architectureNotes?: string[];
}

/** Seed Project Brain DNA through ProjectBrain API. */
export async function writeProjectBrainFiles(
  neuronDir: string,
  input: ProjectBrainInput,
): Promise<void> {
  const cwd = join(neuronDir, '..');
  const brain = await openProjectBrain(cwd, {
    seed: {
      projectId: input.projectId,
      name: input.projectName,
      stack: input.stack,
      summary: input.architectureNotes?.join(' '),
    },
  });
  brain.seedIdentity({
    projectId: input.projectId,
    name: input.projectName,
    stack: input.stack,
    summary: input.architectureNotes?.join(' '),
  });
  if (!brain.prefs) {
    await brain.savePrefs({
      schemaVersion: 1,
      project: {
        id: input.projectId,
        name: input.projectName,
        stack: input.stack ?? [],
      },
      privacy: { mode: 'suggest', localOnly: true, telemetry: false },
      memory: { autoSave: true, threshold: 0.45 },
    });
  }
  await brain.save();
}
