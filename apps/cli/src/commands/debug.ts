import { join } from 'node:path';

import { createObservabilityEngine } from '@neuron-ai-memory/observability';

import {
  isNeuronInitialized,
  neuronPaths,
} from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

/**
 * Toggle / inspect Neuron debug mode (verbose reasoning, retrieval, modules).
 * Default: OFF.
 */
export async function runDebug(
  cwd = process.cwd(),
  options: {
    on?: boolean;
    off?: boolean;
    retention?: string;
    demo?: boolean;
  } = {},
): Promise<void> {
  ui.title('Neuron debug');
  ui.blank();

  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const paths = neuronPaths(cwd);
  const eng = createObservabilityEngine();
  await eng.load(paths.neuronDir);

  if (options.off) {
    eng.setDebugMode(false);
  } else if (options.on) {
    eng.setDebugMode(true);
  }

  if (options.retention) {
    const mode = options.retention as 'disable' | 'temporary' | 'persistent';
    if (!['disable', 'temporary', 'persistent'].includes(mode)) {
      ui.error('retention must be disable | temporary | persistent');
      process.exitCode = 1;
      return;
    }
    eng.setRetention({ mode });
  }

  if (options.demo) {
    eng.recordOperation({
      trace: {
        operation: 'cli debug demo',
        operationKind: 'explain',
        durationMs: 25,
        inputType: 'cli',
        outputType: 'trace',
        confidence: 0.88,
        contextSources: ['cli:demo'],
        summary: 'CLI demo trace',
      },
      reasoning: {
        userRequest: 'Show me a debug session',
        selectedMemories: ['CLI debug demo memory'],
        finalResponse: 'Debug mode surfaces the reasoning path.',
        finalConfidence: 0.88,
      },
      memories: [
        {
          title: 'CLI debug demo memory',
          confidence: 0.9,
          reason: 'Seeded for neuron debug --demo',
        },
      ],
    });
  }

  await eng.save(paths.neuronDir);
  const report = await eng.writeReport(paths.neuronDir);

  ui.kv('Debug mode', eng.isDebugMode() ? 'ON' : 'OFF (default)');
  ui.kv('Retention', JSON.stringify(eng.getRetention()));
  ui.kv('Traces file', join(paths.neuronDir, 'traces.json'));
  if (report) ui.kv('Report', report);

  if (eng.isDebugMode()) {
    ui.blank();
    console.log(eng.debugSessionSummary());
  } else {
    ui.blank();
    ui.info('Debug is OFF. Enable with: neuron debug --on');
    ui.suggest('Explain last op: neuron explain-last');
  }
}

/**
 * Show the last Neuron operation trace (why it suggested something).
 */
export async function runExplainLast(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron explain-last');
  ui.blank();

  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const paths = neuronPaths(cwd);
  const eng = createObservabilityEngine();
  await eng.load(paths.neuronDir);
  const explained = eng.explainLast();

  if (!explained.trace) {
    ui.warn('No traces recorded yet.');
    ui.suggest('neuron debug --on --demo');
    ui.suggest('Or ask Cursor: “Why did you suggest this?” (MCP neuron_explain_reasoning)');
    process.exitCode = 1;
    return;
  }

  console.log('## Operation');
  ui.kv('id', explained.trace.id);
  ui.kv('operation', explained.trace.operation);
  ui.kv('duration', `${explained.trace.durationMs} ms`);
  ui.kv(
    'confidence',
    explained.trace.confidence !== undefined
      ? `${Math.round(explained.trace.confidence * 100)}%`
      : 'n/a',
  );
  ui.blank();

  if (explained.reasoningPath) {
    console.log('## Reasoning path');
    console.log(explained.reasoningPath);
    ui.blank();
  }

  if (explained.memoryUsage?.memories.length) {
    console.log('## Memories used');
    for (const m of explained.memoryUsage.memories) {
      console.log(`Used:\n${m.title}\n\nConfidence:\n${Math.round(m.confidence * 100)}%\n\nReason:\n${m.reason}\n`);
    }
  }

  const report = await eng.writeReport(paths.neuronDir);
  if (report) {
    ui.blank();
    ui.suggest(`Full report: ${report}`);
  }
}
