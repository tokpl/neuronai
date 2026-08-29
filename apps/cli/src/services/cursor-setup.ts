import { resolve } from 'node:path';

import {
  installCursorIntegration,
  installAntigravityIntegration,
  runCursorDoctorChecks,
} from '@neuronai/cursor-integration';

import { isNeuronInitialized } from './neuron-fs.js';
import { openProjectSession } from './project-session.js';

/** Ensure Project Brain knowledge plane matches engine memories. */
export async function syncProjectBrainFiles(cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) return;
  const session = await openProjectSession(cwd);
  await session.persist();
}

export async function setupCursorIntegration(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
) {
  const root = resolve(cwd);
  return installCursorIntegration(root, options);
}

export async function setupAntigravityIntegration(
  cwd = process.cwd(),
  options: { force?: boolean } = {},
) {
  const root = resolve(cwd);
  return installAntigravityIntegration(root, options);
}

export async function diagnoseCursor(cwd = process.cwd()) {
  return runCursorDoctorChecks(resolve(cwd));
}
