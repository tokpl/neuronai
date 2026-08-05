import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createRootCauseAnalyzer } from '../analysis/root-cause.js';
import { createAutomaticIncidentDetector } from '../diagnostics/auto-detect.js';
import { createRegressionAnalyzer } from '../diagnostics/regression.js';
import { createIncidentMemoryFactory } from '../incidents/memory.js';
import { createIncidentRegistry } from '../incidents/registry.js';
import { createErrorPatternDatabase } from '../patterns/database.js';
import { createFixValidator } from '../resolution/fix-validator.js';
import { createDebugSessionManager } from '../session/manager.js';
import { createIncidentTimeline } from '../timeline/timeline.js';
import type {
  Incident,
  IncidentLink,
  IncidentSeverity,
  IncidentStoreDocument,
} from '../types.js';
import { nowIso } from '../types.js';

/**
 * Debug Intelligence facade — analyzes and remembers incidents; never deploys fixes.
 */
export class DebugIntelligence {
  private readonly registry = createIncidentRegistry();
  private readonly memories = createIncidentMemoryFactory();
  private readonly rca = createRootCauseAnalyzer();
  private readonly patterns = createErrorPatternDatabase();
  private readonly regression = createRegressionAnalyzer();
  private readonly validator = createFixValidator();
  private readonly timeline = createIncidentTimeline();
  private readonly sessions = createDebugSessionManager();
  private readonly autoDetect = createAutomaticIncidentDetector();

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'incidents.json'), 'utf8'),
      ) as IncidentStoreDocument;
      this.registry.load(raw);
      for (const e of raw.timeline ?? []) {
        this.timeline.add(e);
      }
    } catch {
      /* fresh */
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'incidents.json');
    const doc: IncidentStoreDocument = {
      version: 1,
      incidents: this.registry.list(),
      patterns: this.patterns.list(),
      timeline: this.timeline.list(200),
      sessions: [],
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    await writeFile(join(neuronDir, 'incident-timeline.md'), this.timeline.markdown(), 'utf8');
    return path;
  }

  createIncident(input: {
    title: string;
    description: string;
    severity?: IncidentSeverity;
    affectedModules?: string[];
    links?: IncidentLink[];
    errorSignature?: string;
  }): Incident {
    const inc = this.registry.create(input);
    this.timeline.add({
      kind: 'incident',
      title: 'Incident reported',
      detail: `${inc.title} [${inc.severity}]`,
    });
    return inc;
  }

  resolveIncident(
    id: string,
    input: {
      rootCause: string;
      solution: string;
      preventiveActions?: string[];
      lesson?: string;
    },
  ) {
    const inc = this.registry.resolve(id, input);
    this.patterns.remember({
      errorType: inc.affectedModules[0] ?? 'Error',
      signature: (inc.errorSignature ?? inc.title).toLowerCase().slice(0, 40),
      cause: input.rootCause,
      solution: input.solution,
    });
    this.timeline.add({
      kind: 'fix',
      title: 'Fix recorded',
      detail: `${inc.title}: ${input.solution}`,
    });
    const memory = this.memories.fromResolved(inc);
    return { incident: inc, memory, markdown: this.memories.markdown(memory) };
  }

  searchIncidents(query: string): Incident[] {
    return this.registry.search(query);
  }

  incidentHistory(id: string) {
    const incident = this.registry.get(id);
    if (!incident) throw new Error(`Unknown incident: ${id}`);
    return {
      incident,
      timeline: this.timeline
        .list(100)
        .filter((e) => e.detail.includes(incident.title) || e.detail.includes(incident.id)),
      memory:
        incident.status === 'RESOLVED' || incident.status === 'ARCHIVED'
          ? this.memories.fromResolved(incident)
          : null,
    };
  }

  rootCause(input: {
    query: string;
    errorMessage?: string;
    stackTrace?: string;
    changedFiles?: string[];
    decisions?: string[];
  }) {
    return this.rca.analyze({
      ...input,
      previousIncidents: this.registry.list(),
    });
  }

  debugContext(input: {
    query: string;
    errorMessage?: string;
    stackTrace?: string;
    changedFiles?: string[];
    relatedMemories?: string[];
    decisions?: string[];
  }) {
    const session = this.sessions.start({
      ...input,
      incidents: this.registry.list(),
    });
    return {
      session,
      relatedIncidents: session.relatedIncidents,
      previousSolutions: session.relatedIncidents
        .filter((i) => i.solution)
        .map((i) => ({ title: i.title, solution: i.solution, lesson: i.lesson })),
      affectedModules: [
        ...new Set(session.relatedIncidents.flatMap((i) => i.affectedModules)),
      ],
      possibleCauses: session.possibleCauses,
      riskFactors: session.riskFactors,
      patterns: this.patterns.match(
        `${input.errorMessage ?? ''} ${input.stackTrace ?? ''} ${input.query}`,
      ),
      note: 'Neuron assists debugging — it does not auto-fix or deploy.',
    };
  }

  validateFix(incidentId: string, changeSummary: string, changedPaths?: string[]) {
    const incident = this.registry.get(incidentId);
    if (!incident) throw new Error(`Unknown incident: ${incidentId}`);
    return this.validator.validate({ incident, changeSummary, changedPaths });
  }

  findRegressions(query: string) {
    return this.regression.findSimilar(query, this.registry.list());
  }

  proposeDetections(input: {
    recentErrors?: string[];
    failedTests?: string[];
    productionSignals?: string[];
  }) {
    return this.autoDetect.propose(input);
  }

  timelineMarkdown(): string {
    return this.timeline.markdown();
  }

  recordTimelineChain(input: Parameters<ReturnType<typeof createIncidentTimeline>['recordChain']>[0]) {
    this.timeline.recordChain(input);
  }
}

export function createDebugIntelligence(): DebugIntelligence {
  return new DebugIntelligence();
}
