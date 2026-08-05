/**
 * Local visualization export — graph.json shape (no hosted dashboard).
 */
export {
  exportGraphJson,
  type GraphJsonExport,
} from '../export/graph-json-export.js';

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GraphJsonExport } from '../export/graph-json-export.js';

export async function writeGraphVisualization(
  neuronDataDir: string,
  graph: GraphJsonExport,
): Promise<string> {
  const path = join(neuronDataDir, 'graph.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(graph, null, 2), 'utf8');
  return path;
}
