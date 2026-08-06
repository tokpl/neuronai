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
  const eff = prepared.efficiency;

  ui.title('Project Brain');
  console.log('────────────────────────');
  ui.blank();

  // The markdown document is the product — same payload MCP puts in the prompt.
  console.log(prepared.context.trimEnd());
  ui.blank();
  console.log('────────────────────────');
  console.log(
    `Context: ${eff.contextTokens} / ${eff.budgetTokens} tokens · ${eff.retrievalMs} ms · ${prepared.intent}`,
  );
  if (eff.estimatedTokensSaved > 0) {
    console.log(
      `Brain compression: ~${formatTokens(eff.estimatedTokensSaved)} vs whole-brain paste`,
    );
  }
  if (eff.estimatedRediscoveryAvoided && eff.estimatedRediscoveryAvoided > 0) {
    console.log(
      `Estimated rediscovery avoided (simulated): ~${formatTokens(eff.estimatedRediscoveryAvoided)}`,
    );
  }
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k tokens`;
  return `${n} tokens`;
}
