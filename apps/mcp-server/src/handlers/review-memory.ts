import { MemoryClassifier, ImportanceEngine } from '@neuronai/ai-memory';
import { MockAIProvider } from '@neuronai/ai-provider';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleReviewMemory(
  runtime: NeuronRuntime,
  args: { projectId?: string; text: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    resolveProjectId(runtime, args.projectId);

    const classifier = new MemoryClassifier(new MockAIProvider());
    const classification = await classifier.classify(args.text);

    if (!classification.memoryType) {
      return okResult({
        shouldSave: false,
        reason: 'Classified as IGNORE - ephemeral or low-signal content',
        suggestedType: null,
        importance: 0.1,
      });
    }

    const importance = new ImportanceEngine().score({
      type: classification.memoryType,
      content: args.text,
      source: 'agent',
      confidence: classification.confidence,
    });

    const shouldSave = importance.action === 'auto_save' || importance.action === 'ask_user';

    return okResult({
      shouldSave,
      reason: importance.rationale,
      suggestedType: classification.memoryType,
      importance: importance.score,
      action: importance.action,
      confidence: classification.confidence,
    });
  } catch (error) {
    return failResult(error);
  }
}
