import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createProjectConstitutionService } from '@neuron-ai-memory/project-constitution';

import { isNeuronInitialized, loadLocalConfig, neuronPaths } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

async function requireInit(cwd: string): Promise<boolean> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.failHelp(
      'Neuron is not initialized.',
      ['Missing .neuron/config.json'],
      ['neuron init', 'neuron init cursor'],
    );
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function collectNames(cwd: string): Promise<string[]> {
  const names: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || names.length > 400) return;
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

function service(cwd: string, config: Awaited<ReturnType<typeof loadLocalConfig>>) {
  const paths = neuronPaths(cwd);
  return createProjectConstitutionService({
    neuronDir: paths.neuronDir,
    projectId: config.project.id,
    projectName: config.project.name,
    projectRoot: paths.root,
  });
}

export async function runConstitutionShow(cwd = process.cwd()): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const svc = service(cwd, config);
  const result = await svc.getRules();
  ui.title('Project Constitution');
  ui.blank();
  console.log(result.markdown);
  ui.kv('Active', String(result.activeCount));
  ui.kv('Suggested', String(result.suggestedCount));
}

export async function runConstitutionSuggest(cwd = process.cwd()): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);
  const svc = service(cwd, config);
  const files = await collectNames(cwd);
  const { suggestions, patterns } = await svc.suggestRules(session.listMemories(), files);
  ui.title('Constitution suggestions');
  ui.blank();
  for (const p of patterns) ui.info(`Pattern: ${p.summary}`);
  for (const s of suggestions.slice(0, 15)) {
    ui.success(`[${s.rule.severity}] ${s.rule.category}: ${s.rule.rule}`);
    ui.info(`  id=${s.rule.id}`);
  }
  ui.blank();
  ui.suggest('Review then: neuron constitution accept <ruleId>');
  ui.suggest('Never auto-activate CRITICAL — use: neuron constitution accept <id> --critical');
}

export async function runConstitutionAccept(
  ruleId: string,
  cwd = process.cwd(),
  options: { critical?: boolean } = {},
): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const svc = service(cwd, config);
  await svc.acceptRule(ruleId, Boolean(options.critical));
  ui.success(`Accepted rule ${ruleId}${options.critical ? ' as CRITICAL (manual)' : ''}`);
  ui.suggest('neuron constitution cursor-rules');
}

export async function runConstitutionHealth(cwd = process.cwd()): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);
  const svc = service(cwd, config);
  const report = await svc.projectHealth(session.listMemories());
  ui.title(report.summary);
  ui.blank();
  for (const d of report.dimensions) {
    ui.kv(d.name, `${d.score}/100`);
  }
}

export async function runConstitutionEvolution(
  cwd = process.cwd(),
  options: { commits?: number } = {},
): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const svc = service(cwd, config);
  const files = await collectNames(cwd);
  const review = await svc.reviewEvolution({
    commitsSinceReview: options.commits,
    fileNames: files,
  });
  ui.title('Evolution review');
  ui.blank();
  console.log(review.message);
  if (review.shouldReview) {
    ui.suggest('neuron constitution suggest');
    ui.suggest('neuron constitution accept <id> for approved rules');
  }
}

export async function runConstitutionCursorRules(cwd = process.cwd()): Promise<void> {
  if (!(await requireInit(cwd))) return;
  const config = await loadLocalConfig(cwd);
  const svc = service(cwd, config);
  const result = await svc.generateCursorRules();
  ui.success(`Wrote Cursor rules (${result.ruleCount} active constitution rules)`);
  ui.kv('Path', result.path);
}
