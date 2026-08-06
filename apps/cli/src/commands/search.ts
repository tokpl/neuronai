import { isNeuronInitialized } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

export async function runSearch(query: string, cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const session = await openProjectSession(cwd);
  const hits = session.search(query, 10);

  ui.title(`Search: ${query}`);
  ui.blank();

  if (hits.length === 0) {
    ui.warn('No memories matched.');
    ui.suggest('Try: neuron scan');
    return;
  }

  for (const hit of hits) {
    console.log(`${paintScore(hit.score)} ${hit.doc.title}`);
    const preview = hit.doc.content.replace(/\s+/g, ' ').slice(0, 140);
    ui.info(`    ${preview}${hit.doc.content.length > 140 ? '…' : ''}`);
    ui.info(`    ${hit.doc.kind} · ${hit.why}`);
    ui.blank();
  }
}

function paintScore(score: number): string {
  const pct = Math.round(Math.min(1, score) * 100);
  return `[${String(pct).padStart(3, ' ')}%]`;
}
