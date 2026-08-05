import { isNeuronInitialized, loadLocalConfig } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

export async function runSearch(query: string, cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const config = await loadLocalConfig(cwd);
  const session = await openProjectSession(cwd);
  const hits = await session.searchEngine.search({
    projectId: config.project.id,
    query,
    limit: 10,
  });

  ui.title(`Search: ${query}`);
  ui.blank();

  if (hits.length === 0) {
    ui.warn('No memories matched.');
    ui.suggest('Try: neuron analyze');
    return;
  }

  for (const hit of hits) {
    console.log(paintScore(hit.score) + ` ${hit.memory.title}`);
    ui.info(`    ${hit.memory.content.slice(0, 140)}${hit.memory.content.length > 140 ? '…' : ''}`);
    ui.info(
      `    type=${hit.memory.type} confidence=${hit.memory.confidenceScore.toFixed(2)} score=${hit.score.toFixed(3)}`,
    );
    ui.blank();
  }
}

function paintScore(score: number): string {
  const pct = Math.round(score * 100);
  return `[${String(pct).padStart(3, ' ')}%]`;
}
