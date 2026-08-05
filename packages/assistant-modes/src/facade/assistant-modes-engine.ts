import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createModeContextPlanner } from '../context/mode-context.js';
import { createModeExecutor } from '../execution/mode-executor.js';
import { createModeUsageMemory } from '../execution/mode-usage-memory.js';
import { getModeById, listModes } from '../modes/builtin.js';
import { createModeRouter } from '../profiles/mode-router.js';
import type {
  AssistantModesStoreDocument,
  ContextNeed,
  ModeId,
  ModeOutput,
  NeuronMode,
} from '../types.js';
import { nowIso } from '../types.js';

const STORE_FILE = 'assistant-modes.json';

export interface RunModeResult {
  route: {
    modeId: ModeId;
    modeName: string;
    reason: string;
    confidence: number;
    alternatives: Array<{ modeId: ModeId; score: number }>;
  };
  context: ReturnType<ReturnType<typeof createModeContextPlanner>['describe']>;
  output: ModeOutput;
  prompt: { system: string; user: string };
  evaluation: ReturnType<ReturnType<typeof createModeUsageMemory>['evaluate']>;
  note: string;
}

/**
 * Developer intelligence modes facade — MCP workflow layer.
 */
export class AssistantModesEngine {
  readonly router = createModeRouter();
  readonly context = createModeContextPlanner();
  readonly executor = createModeExecutor();
  readonly usage = createModeUsageMemory();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, STORE_FILE), 'utf8'),
      ) as AssistantModesStoreDocument;
      this.usage.load(raw.usage ?? []);
    } catch {
      /* empty */
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const doc: AssistantModesStoreDocument = {
      version: 1,
      usage: this.usage.snapshot(),
      updatedAt: nowIso(),
    };
    const path = join(neuronDir, STORE_FILE);
    await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return path;
  }

  availableModes(): NeuronMode[] {
    return listModes();
  }

  modeContext(
    modeId: string,
    availableContext: ContextNeed[] = [],
  ) {
    const mode = getModeById(modeId);
    if (!mode) throw new Error(`Unknown mode: ${modeId}`);
    return this.context.describe(mode, availableContext);
  }

  runMode(input: {
    query: string;
    modeId?: string;
    availableContext?: ContextNeed[];
    useful?: boolean;
    feedback?: string;
    accuracyHint?: number;
  }): RunModeResult {
    const route = this.router.route(input.query, input.modeId);
    const ctx = this.context.describe(route.mode, input.availableContext ?? []);
    const output = this.executor.run({
      mode: route.mode,
      query: input.query,
      routeConfidence: route.score,
      evidence: ctx.ready
        ? [`Context ready (${ctx.available.join(', ') || 'partial'})`]
        : [`Missing context: ${ctx.missing.join(', ')}`, ...ctx.hints.slice(0, 3)],
    });
    const prompt = this.executor.promptBundle(route.mode, input.query);

    this.usage.record({
      modeId: route.mode.id,
      query: input.query,
      useful: input.useful,
      feedback: input.feedback,
      accuracyHint: input.accuracyHint ?? output.confidence,
    });

    return {
      route: {
        modeId: route.mode.id,
        modeName: route.mode.name,
        reason: route.reason,
        confidence: route.score,
        alternatives: route.alternatives,
      },
      context: ctx,
      output,
      prompt,
      evaluation: this.usage.evaluate(route.mode.id),
      note: 'Advisory mode workflow — no autonomous agents or automatic code changes.',
    };
  }
}

export function createAssistantModesEngine(): AssistantModesEngine {
  return new AssistantModesEngine();
}
