import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createFocusManager } from '../context/focus.js';
import { createInterruptionMemory } from '../context/interruption.js';
import { assertTechnicalOnly, sanitizeTechnicalText } from '../context/privacy.js';
import { createGitIntelligence } from '../git/git-intelligence.js';
import type { CommitAnalyzeInput } from '../git/types.js';
import type { LinkableKnowledge } from '../git/decision-linker.js';
import { createHandoffGenerator } from '../handoff/generator.js';
import { createContinuationEngine } from '../progress/continuation.js';
import { createSessionSummaryGenerator } from '../progress/session-summary.js';
import { createFlowMetricsAnalyzer } from '../recommendations/flow-metrics.js';
import { createSessionStore } from '../sessions/store.js';
import { createTaskPlanner } from '../tasks/planner.js';
import { createTaskMemoryStore } from '../tasks/store.js';
import type {
  FocusContext,
  TechnicalTaskMemory,
  WorkflowStoreDocument,
} from '../types.js';
import { nowIso } from '../types.js';

/**
 * Workflow Intelligence — technical work context only.
 * No time tracking, employee monitoring, or people productivity scores.
 */
export class WorkflowIntelligence {
  private readonly sessions = createSessionStore();
  private readonly tasks = createTaskMemoryStore();
  private readonly focusMgr = createFocusManager();
  private readonly interruptions = createInterruptionMemory();
  private readonly continuation = createContinuationEngine();
  private readonly summaries = createSessionSummaryGenerator();
  private readonly handoffs = createHandoffGenerator();
  private readonly planner = createTaskPlanner();
  private readonly flow = createFlowMetricsAnalyzer();
  private readonly git = createGitIntelligence();
  private focus: FocusContext | null = null;

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'workflow.json'), 'utf8'),
      ) as WorkflowStoreDocument;
      this.sessions.load(raw.sessions ?? []);
      this.tasks.load(raw.tasks ?? []);
      this.focus = raw.focus ?? null;
      this.interruptions.load(raw.interruptions ?? []);
    } catch {
      /* fresh */
    }
    await this.git.load(neuronDir);
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'workflow.json');
    const doc: WorkflowStoreDocument = {
      version: 1,
      sessions: this.sessions.list(),
      tasks: this.tasks.list(),
      focus: this.focus,
      interruptions: this.interruptions.list(),
      updatedAt: nowIso(),
    };
    await writeFile(path, JSON.stringify(doc, null, 2), 'utf8');
    await this.git.save(neuronDir);
    return path;
  }

  async writeWorkSummary(neuronDir: string, markdown: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'work-summary.md');
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  async writeHandoff(neuronDir: string, markdown: string): Promise<string> {
    await mkdir(join(neuronDir, 'docs'), { recursive: true });
    const path = join(neuronDir, 'docs', 'handoff.md');
    await writeFile(path, markdown, 'utf8');
    return path;
  }

  startSession(input: {
    project: string;
    activeArea: string;
    relatedFiles?: string[];
    relatedTasks?: string[];
    decisions?: string[];
    unfinishedWork?: string[];
    branch?: string;
  }) {
    assertTechnicalOnly([
      input.activeArea,
      ...(input.decisions ?? []),
      ...(input.unfinishedWork ?? []),
    ]);
    const session = this.sessions.start({
      ...input,
      activeArea: sanitizeTechnicalText(input.activeArea),
      decisions: (input.decisions ?? []).map(sanitizeTechnicalText),
      unfinishedWork: (input.unfinishedWork ?? []).map(sanitizeTechnicalText),
    });
    this.focus = this.focusMgr.focus({
      area: session.activeArea,
      relatedFiles: session.relatedFiles,
    });
    return { session, focus: this.focus };
  }

  updateActiveSession(
    patch: Partial<{
      activeArea: string;
      relatedFiles: string[];
      relatedTasks: string[];
      decisions: string[];
      unfinishedWork: string[];
      branch: string;
      commits: string[];
      summary: string;
      status: 'active' | 'paused' | 'closed';
    }>,
  ) {
    const active = this.sessions.active();
    if (!active) throw new Error('No active session');
    if (patch.activeArea) assertTechnicalOnly([patch.activeArea]);
    const updated = this.sessions.update(active.id, {
      ...patch,
      activeArea: patch.activeArea ? sanitizeTechnicalText(patch.activeArea) : undefined,
      decisions: patch.decisions?.map(sanitizeTechnicalText),
      unfinishedWork: patch.unfinishedWork?.map(sanitizeTechnicalText),
      summary: patch.summary ? sanitizeTechnicalText(patch.summary) : undefined,
    });
    if (patch.activeArea) {
      this.focus = this.focusMgr.focus({
        area: updated.activeArea,
        relatedFiles: updated.relatedFiles,
      });
    }
    return updated;
  }

  upsertTask(input: {
    id?: string;
    title: string;
    status?: TechnicalTaskMemory['status'];
    percentComplete?: number;
    completed?: string[];
    remaining?: string[];
    relatedDecisions?: string[];
    relatedFiles?: string[];
    risks?: string[];
  }): TechnicalTaskMemory {
    assertTechnicalOnly([input.title, ...(input.completed ?? []), ...(input.remaining ?? [])]);
    return this.tasks.upsert(input);
  }

  setFocus(area: string, modules?: string[], relatedFiles?: string[]): FocusContext {
    assertTechnicalOnly([area]);
    this.focus = this.focusMgr.focus({ area, modules, relatedFiles });
    const active = this.sessions.active();
    if (active) {
      this.sessions.update(active.id, {
        activeArea: area,
        relatedFiles: relatedFiles ?? active.relatedFiles,
      });
    }
    return this.focus;
  }

  currentFocus(): FocusContext | null {
    return this.focus;
  }

  pauseWithInterruption(input: {
    whyStarted: string;
    whatChanged?: string[];
    whatRemainsRisky?: string[];
  }) {
    assertTechnicalOnly([
      input.whyStarted,
      ...(input.whatChanged ?? []),
      ...(input.whatRemainsRisky ?? []),
    ]);
    const active = this.sessions.active();
    const area = active?.activeArea ?? 'Unknown';
    if (active) this.sessions.update(active.id, { status: 'paused' });
    return this.interruptions.record({
      whyStarted: sanitizeTechnicalText(input.whyStarted),
      whatChanged: (input.whatChanged ?? active?.relatedFiles ?? []).map(sanitizeTechnicalText),
      whatRemainsRisky: (input.whatRemainsRisky ?? active?.unfinishedWork ?? []).map(
        sanitizeTechnicalText,
      ),
      activeArea: area,
    });
  }

  resume(pendingDecisions?: string[]) {
    return this.continuation.resume({
      session: this.sessions.active() ?? null,
      tasks: this.tasks.list(),
      focus: this.focus,
      interruption: this.interruptions.latest() ?? null,
      pendingDecisions,
    });
  }

  /** Alias for Cursor neuron_resume_context */
  resumeContext(pendingDecisions?: string[]) {
    return this.resume(pendingDecisions);
  }

  sessionSummary(sessionId?: string) {
    const session = sessionId
      ? this.sessions.get(sessionId)
      : this.sessions.active() ?? this.sessions.list()[0];
    if (!session) throw new Error('No session to summarize');
    const markdown = this.summaries.markdown({
      session,
      tasks: this.tasks.list().filter((t) => session.relatedTasks.includes(t.id)),
    });
    return { session, markdown };
  }

  closeSession(summary: string, sessionId?: string) {
    assertTechnicalOnly([summary]);
    const session = sessionId ? this.sessions.get(sessionId) : this.sessions.active();
    if (!session) throw new Error('No active session');
    const closed = this.sessions.close(session.id, sanitizeTechnicalText(summary));
    const { markdown } = this.sessionSummary(closed.id);
    return { session: closed, markdown };
  }

  handoff(extra?: { risks?: string[]; decisions?: string[] }) {
    return this.handoffs.generate({
      session: this.sessions.active() ?? this.sessions.list()[0] ?? null,
      tasks: this.tasks.list().filter((t) => t.status !== 'DONE'),
      risks: extra?.risks,
      decisions: extra?.decisions,
    });
  }

  taskContext(query: string) {
    const matches = this.tasks.search(query);
    const plan =
      matches[0] ??
      null;
    const breakdown = this.planner.plan({
      feature: matches[0]?.title ?? query,
      architectureNotes: matches[0]?.relatedDecisions,
      risks: matches[0]?.risks,
    });
    return {
      tasks: matches,
      primary: plan,
      breakdown,
      focus: this.focus,
      note: 'Technical task context — not a Jira replacement.',
    };
  }

  planFeature(feature: string, architectureNotes?: string[], dependencies?: string[]) {
    assertTechnicalOnly([feature]);
    return this.planner.plan({ feature, architectureNotes, dependencies });
  }

  projectFlowMetrics() {
    return this.flow.analyze({
      sessions: this.sessions.list(),
      tasks: this.tasks.list(),
    });
  }

  linkGit(input: { branch?: string; commits?: string[]; changedFiles?: string[] }) {
    const active = this.sessions.active();
    if (!active) throw new Error('No active session to attach git context');
    return this.sessions.update(active.id, {
      branch: input.branch ?? active.branch,
      commits: input.commits ?? active.commits,
      relatedFiles: unique([...(active.relatedFiles ?? []), ...(input.changedFiles ?? [])]),
    });
  }

  /** Git history intelligence API */
  ingestGitCommit(input: CommitAnalyzeInput, knowledge?: LinkableKnowledge) {
    return this.git.ingestCommit(input, knowledge);
  }

  gitContext(query: string) {
    return this.git.gitContext(query);
  }

  changeHistory(module: string) {
    return this.git.changeHistory(module);
  }

  architectureEvolution() {
    return this.git.architectureEvolution();
  }

  regressionCheck(input: CommitAnalyzeInput) {
    return this.git.regressionCheck(input);
  }

  historyContext(question: string) {
    return this.git.historyContext(question);
  }

  engineeringTimeline(extra?: {
    decisions?: Array<{ title: string; at?: string; id?: string }>;
    incidents?: Array<{ title: string; at?: string; id?: string }>;
  }) {
    return this.git.buildTimeline(extra);
  }

  getGitIntelligence() {
    return this.git;
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

export function createWorkflowIntelligence(): WorkflowIntelligence {
  return new WorkflowIntelligence();
}
