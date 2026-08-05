import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';
import { resolveProjectId } from './get-context.js';

export async function handleProjectSummary(
  runtime: NeuronRuntime,
  args: { projectId?: string },
) {
  try {
    runtime.auth.assertAuthorized(process.env['NEURON_API_KEY']);
    const projectId = resolveProjectId(runtime, args.projectId);
    const context = await runtime.engine.getProjectMemoryContext({
      projectId,
      limit: 50,
      maxTokens: 8000,
    });

    const decisions = context.memories.filter((m) => m.type === 'architecture_decision');
    const patterns = context.memories.filter((m) => m.type === 'pattern');
    const dependencies = context.memories.filter((m) => m.type === 'dependency');
    const mistakes = context.memories.filter((m) => m.type === 'mistake');

    return okResult({
      project: {
        id: projectId,
        name: runtime.project.name,
        slug: runtime.project.slug,
        stack: runtime.project.stack,
        git: runtime.project.git,
        manifests: runtime.project.manifests,
        rootPath: runtime.project.rootPath,
      },
      architecture: {
        decisions: decisions.map((d) => ({ title: d.title, content: d.content })),
        modules: dependencies.map((d) => ({ title: d.title, content: d.content })),
      },
      importantDecisions: decisions.slice(0, 10),
      patterns: patterns.slice(0, 10),
      knownMistakes: mistakes.slice(0, 10),
      memoryCount: context.memories.length,
    });
  } catch (error) {
    return failResult(error);
  }
}
