import { isNeuronInitialized } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

/**
 * Show exactly what Neuron would hand an AI assistant for a question.
 * Transparency / debugging — not a second retrieval engine.
 */
export async function runContext(query: string, cwd = process.cwd()): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const session = await openProjectSession(cwd);
  const prepared = session.context({ task: query });

  ui.title('Project Brain');
  console.log('────────────────────────');
  ui.blank();

  // The markdown document is the product — same payload MCP puts in the prompt.
  console.log(prepared.context.trimEnd());
  ui.blank();
  console.log('────────────────────────');
  // Same contribution block Cursor agents append (lines = richer CLI view).
  for (const line of prepared.contribution.lines) {
    console.log(line);
  }
}
