import { join } from 'node:path';

import { createDocumentationIntelligence } from '@neuron-ai-memory/documentation-intelligence';
import { createDebugIntelligence } from '@neuron-ai-memory/debug-intelligence';
import { createSecurityIntelligence } from '@neuron-ai-memory/security-intelligence';
import {
  createProjectConstitutionService,
} from '@neuron-ai-memory/project-constitution';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadDocs(runtime: NeuronRuntime) {
  const docs = createDocumentationIntelligence();
  await docs.load(neuronDir(runtime));
  return docs;
}

async function brainSnapshot(runtime: NeuronRuntime) {
  const modules = new Set<string>();
  const decisions: string[] = [];
  const architectureNotes: string[] = [];
  const mistakes: string[] = [];
  const rules: string[] = [];
  const incidents: string[] = [];
  const securityNotes: string[] = [];

  try {
    const hits = await runtime.searchEngine.search({
      projectId: runtime.project.projectId,
      query: 'architecture modules decisions',
      limit: 20,
    });
    for (const h of hits) {
      if (h.memory.type === 'architecture_decision') {
        decisions.push(`${h.memory.title}: ${h.memory.content}`);
      } else if (h.memory.type === 'mistake') {
        mistakes.push(h.memory.title);
      } else {
        architectureNotes.push(`${h.memory.title}: ${h.memory.content}`.slice(0, 240));
      }
      for (const tag of h.memory.tags ?? []) modules.add(tag);
    }
  } catch {
    /* optional */
  }

  try {
    const svc = createProjectConstitutionService({
      neuronDir: neuronDir(runtime),
      projectId: runtime.project.projectId,
      projectName: runtime.project.name,
      projectRoot: runtime.cwd,
    });
    const { document } = await svc.getRules();
    for (const r of document.rules) {
      if (r.status === 'active' || r.status === 'approved') rules.push(r.rule);
    }
    for (const m of document.mistakes) mistakes.push(m.title);
  } catch {
    /* optional */
  }

  try {
    const dbg = createDebugIntelligence();
    await dbg.load(neuronDir(runtime));
    // Broad tokenless listing via common incident keywords
    const seen = new Set<string>();
    for (const q of ['error', 'bug', 'fail', 'timeout', 'auth', 'payment', 'a']) {
      for (const i of dbg.searchIncidents(q)) {
        if (seen.has(i.id)) continue;
        seen.add(i.id);
        incidents.push(i.title);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const sec = createSecurityIntelligence();
    await sec.load(neuronDir(runtime));
    for (const m of sec.listMemories().slice(0, 10)) {
      securityNotes.push(m.description);
    }
  } catch {
    /* optional */
  }

  for (const s of runtime.project.stack ?? []) {
    if (/auth|payment|user|api|admin/i.test(s)) modules.add(s);
  }

  return {
    projectName: runtime.project.name,
    modules: modules.size
      ? [...modules]
      : inferModules(runtime.project.structureNotes ?? []),
    databases: runtime.project.databases ?? [],
    frameworks: runtime.project.frameworks ?? [],
    dependencies: runtime.project.manifests ?? [],
    decisions,
    incidents,
    securityNotes,
    architectureNotes: [
      ...architectureNotes,
      ...(runtime.project.structureNotes ?? []),
    ].slice(0, 20),
    rules,
    mistakes,
    dataFlows: ['Client → API → Services → Database'],
  };
}

function inferModules(notes: string[]): string[] {
  const mods = new Set<string>(['Core']);
  for (const n of notes) {
    if (/auth/i.test(n)) mods.add('Auth');
    if (/payment|billing/i.test(n)) mods.add('Payment');
    if (/admin/i.test(n)) mods.add('Admin');
  }
  return [...mods];
}

export async function handleGenerateDocs(
  runtime: NeuronRuntime,
  args: {
    includeModules?: boolean;
    includeDecisions?: boolean;
    includeOnboarding?: boolean;
    persist?: boolean;
    readme?: string;
  },
) {
  try {
    const docs = await loadDocs(runtime);
    const brain = await brainSnapshot(runtime);
    if (args.readme) {
      docs.detectDrift({ readme: args.readme, brain });
    }
    const artifacts = docs.generateDocs(brain, {
      includeModules: args.includeModules,
      includeDecisions: args.includeDecisions,
      includeOnboarding: args.includeOnboarding,
    });
    let written: string[] = [];
    if (args.persist !== false) {
      written = await docs.persistGenerated(neuronDir(runtime));
    } else {
      await docs.save(neuronDir(runtime));
    }
    return okResult({
      artifacts: artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        path: a.path,
        title: a.title,
        confidence: a.confidence,
      })),
      drift: docs.detectDrift({ readme: args.readme, brain }),
      written,
      note: 'Generated docs under .neuron/docs/ — manual docs stay in docs/. No hosting/wiki SaaS.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleDocsHealth(runtime: NeuronRuntime, _args: Record<string, never>) {
  try {
    const docs = await loadDocs(runtime);
    const brain = await brainSnapshot(runtime);
    if (!docs.listArtifacts().length) {
      docs.generateDocs(brain);
    }
    const review = docs.review(brain.modules?.length);
    return okResult({
      health: review.health,
      missing: review.missing,
      outdated: review.outdated.map((a) => a.path),
      incorrect: review.incorrect,
      documentationHealth: `${review.health.overall}/100`,
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleExplainProject(
  runtime: NeuronRuntime,
  args: { focus?: string },
) {
  try {
    const docs = await loadDocs(runtime);
    const brain = await brainSnapshot(runtime);
    if (args.focus) {
      brain.architectureNotes = [
        `Focus: ${args.focus}`,
        ...(brain.architectureNotes ?? []),
      ];
    }
    const explanation = docs.explainProject(brain);
    await docs.save(neuronDir(runtime));
    return okResult({
      summary: explanation.summary,
      architectureMarkdown: explanation.architecture.content,
      health: explanation.health,
      note: 'Living architecture summary from Project Brain — not a CMS publish.',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleModuleDocs(
  runtime: NeuronRuntime,
  args: {
    module: string;
    purpose?: string;
    responsibilities?: string[];
    persist?: boolean;
  },
) {
  try {
    const docs = await loadDocs(runtime);
    const brain = await brainSnapshot(runtime);
    const created = docs.moduleDocs({
      name: args.module,
      purpose: args.purpose,
      responsibilities: args.responsibilities,
      dependencies: brain.dependencies?.slice(0, 8),
      securityNotes: brain.securityNotes?.slice(0, 5),
      knownIssues: brain.incidents?.filter((i) =>
        i.toLowerCase().includes(args.module.toLowerCase()),
      ),
      relatedDecisions: brain.decisions?.slice(0, 5),
    });
    let written: string[] = [];
    if (args.persist !== false) {
      written = await docs.persistGenerated(neuronDir(runtime), ['MODULE_DOC']);
    } else {
      await docs.save(neuronDir(runtime));
    }
    return okResult({
      artifacts: created,
      written,
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleGenerateChangelog(
  runtime: NeuronRuntime,
  args: {
    commits?: string[];
    features?: string[];
    persist?: boolean;
  },
) {
  try {
    const docs = await loadDocs(runtime);
    const brain = await brainSnapshot(runtime);
    const artifact = docs.generateChangelog({
      commits: args.commits,
      features: args.features,
      decisions: brain.decisions?.slice(0, 10),
      incidents: brain.incidents?.slice(0, 10),
    });
    let written: string[] = [];
    if (args.persist !== false) {
      written = await docs.persistGenerated(neuronDir(runtime), ['CHANGELOG']);
    } else {
      await docs.save(neuronDir(runtime));
    }
    return okResult({ artifact, written });
  } catch (e) {
    return failResult(e);
  }
}

/** Alias used by Cursor workflow naming */
export async function handleProjectDocumentation(
  runtime: NeuronRuntime,
  args: { focus?: string },
) {
  return handleExplainProject(runtime, args);
}
