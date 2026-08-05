import { createRetrievalEngine } from '@neuron-ai-memory/retrieval-engine';
import { createProjectConstitutionService } from '@neuron-ai-memory/project-constitution';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { isNeuronInitialized, loadLocalConfig, neuronPaths } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

async function collectNames(cwd: string): Promise<string[]> {
  const names: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3 || names.length > 300) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (['node_modules', '.git', 'dist', '.neuron'].includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (/\.(ts|tsx|js|jsx)$/i.test(e.name)) names.push(e.name);
    }
  }
  await walk(cwd, 0);
  return names;
}

export async function runOptimizeContext(
  task: string,
  cwd = process.cwd(),
  options: { explain?: boolean; architecture?: boolean } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.failHelp('Neuron is not initialized.', ['Missing .neuron'], ['neuron init']);
    process.exitCode = 1;
    return;
  }

  const config = await loadLocalConfig(cwd);
  const paths = neuronPaths(cwd);
  const session = await openProjectSession(cwd);
  const memories = session.listMemories();

  let constitutionRules: string[] = [];
  try {
    const svc = createProjectConstitutionService({
      neuronDir: paths.neuronDir,
      projectId: config.project.id,
      projectName: config.project.name,
      projectRoot: paths.root,
    });
    constitutionRules = (await svc.load()).rules
      .filter((r) => r.status === 'active')
      .map((r) => r.rule);
  } catch {
    /* optional */
  }

  const engine = createRetrievalEngine();
  const result = options.architecture
    ? await engine.architectureContext({
        task,
        memories,
        constitutionRules,
        fileNames: await collectNames(cwd),
      })
    : await engine.retrieve({
        task,
        memories,
        constitutionRules,
        fileNames: await collectNames(cwd),
        agentMode: 'standard',
      });

  ui.title('Optimized agent context');
  ui.blank();
  ui.kv('Intent', result.query.intent);
  ui.kv('Risk', result.query.risk);
  ui.kv('Budget', `${result.budget.maxTokens} tokens / ${result.budget.maxItems} items`);
  ui.kv('Tokens used', String(result.context.tokenEstimate));
  ui.kv('Saved', `~${result.compression.savedTokens} tokens (${result.compression.techniques.join(', ') || 'n/a'})`);
  ui.blank();
  console.log(result.context.markdown);
  if (options.explain) {
    ui.blank();
    ui.title('Why these items?');
    for (const line of result.context.explanation) ui.info(line);
  }
}
