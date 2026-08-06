/**
 * Local visualization export — ephemeral under `.neuron/runtime/`.
 */
export {
  exportGraphJson,
  type GraphJsonExport,
} from '../export/graph-json-export.js';

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { resolveBrainPaths } from '@neuronai/brain';

import type { GraphJsonExport } from '../export/graph-json-export.js';

export async function writeGraphVisualization(
  projectRoot: string,
  graph: GraphJsonExport,
): Promise<string> {
  const paths = resolveBrainPaths(projectRoot);
  const path = join(paths.runtimeDir, 'graph-export.json');
  await mkdir(paths.runtimeDir, { recursive: true });
  await writeFile(path, JSON.stringify(graph, null, 2), 'utf8');
  return path;
}
