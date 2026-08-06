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

  console.log('Question:');
  console.log(`  ${query}`);
  ui.blank();

  if (prepared.recommendation) {
    console.log('Recommended start:');
    console.log(`  ${prepared.recommendation.path}`);
    if (prepared.recommendation.reason) {
      console.log(`  (${prepared.recommendation.reason})`);
    }
    ui.blank();
  }

  if (
    prepared.relevantModules.length === 0 &&
    prepared.relevantFiles.length === 0 &&
    prepared.relevantRules.length === 0 &&
    !prepared.recommendation
  ) {
    if (!prepared.context.includes('No stored project knowledge')) {
      console.log(prepared.context.trim());
    } else {
      ui.warn('No relevant project knowledge matched.');
      ui.suggest('Try: neuron scan');
    }
  } else {
    if (prepared.relevantModules.length || prepared.relevantFiles.length) {
      console.log('Brain:');
      const seen = new Set<string>();
      for (const mod of prepared.relevantModules) {
        if (seen.has(mod.path)) continue;
        seen.add(mod.path);
        console.log(`  ${mod.path}`);
      }
      for (const file of prepared.relevantFiles) {
        const label =
          file.kind === 'symbol' ? `${file.name} → ${file.path}` : file.path;
        if (seen.has(label)) continue;
        seen.add(label);
        console.log(`  ${label}`);
      }
      ui.blank();
    }

    if (prepared.relevantRules.length) {
      console.log('Rules:');
      for (const rule of prepared.relevantRules) {
        console.log(`  ${rule.title}`);
      }
      ui.blank();
    }
  }

  console.log('Context:');
  console.log(`  ${eff.contextTokens} / ${eff.budgetTokens} tokens`);
  if (eff.estimatedTokensSaved > 0) {
    console.log('Estimated Brain compression:');
    console.log(
      `  ~${formatTokens(eff.estimatedTokensSaved)} avoided (vs whole-brain paste)`,
    );
  }
  console.log('Retrieval:');
  console.log(`  ${eff.retrievalMs} ms · ${prepared.intent}`);
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k tokens`;
  return `${n} tokens`;
}
