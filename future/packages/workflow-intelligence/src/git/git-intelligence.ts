import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createArchitectureEvolutionTracker } from './architecture-evolution.js';
import { createBlameIntelligence } from './blame-intelligence.js';
import { createCommitAnalyzer } from './commit-analyzer.js';
import {
  createDecisionConnectionLinker,
  type LinkableKnowledge,
} from './decision-linker.js';
import { createEngineeringTimelineBuilder } from './engineering-timeline.js';
import { createRegressionDetector } from './regression-detector.js';
import type {
  ArchitectureTransition,
  CommitAnalyzeInput,
  GitChangeMemory,
  GitIntelligenceStoreDocument,
  RegressionMatch,
} from './types.js';
import { nowIso } from './types.js';

const STORE_FILE = 'git-intelligence.json';

/**
 * Git history intelligence — Git is a knowledge source, not a host we replace.
 */
export class GitIntelligence {
  readonly analyzer = createCommitAnalyzer();
  readonly evolution = createArchitectureEvolutionTracker();
  readonly linker = createDecisionConnectionLinker();
  readonly regressions = createRegressionDetector();
  readonly blame = createBlameIntelligence();
  readonly timeline = createEngineeringTimelineBuilder();

  private changes: GitChangeMemory[] = [];

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, STORE_FILE), 'utf8'),
      ) as GitIntelligenceStoreDocument;
      this.changes = raw.changes ?? [];
      this.evolution.load(raw.transitions ?? []);
    } catch {
      this.changes = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const doc: GitIntelligenceStoreDocument = {
      version: 1,
      changes: this.changes.slice(0, 200),
      transitions: this.evolution.list().slice(0, 100),
      updatedAt: nowIso(),
    };
    const path = join(neuronDir, STORE_FILE);
    await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    return path;
  }

  ingestCommit(
    input: CommitAnalyzeInput,
    knowledge?: LinkableKnowledge,
  ): {
    change: GitChangeMemory;
    transition?: ArchitectureTransition;
    regressions: RegressionMatch[];
  } {
    let change = this.analyzer.analyze(input);
    if (knowledge) {
      change = this.linker.link(change, knowledge);
    }
    this.changes.unshift(change);
    this.changes = this.changes.slice(0, 200);
    const transition = this.evolution.observe(change);
    const regressions = this.regressions.check(
      change,
      this.changes.slice(1),
      input.knownProblemCommits,
    );
    return { change, transition, regressions };
  }

  listChanges(moduleOrPath?: string): GitChangeMemory[] {
    if (!moduleOrPath) return [...this.changes];
    const q = moduleOrPath.toLowerCase();
    return this.changes.filter(
      (c) =>
        c.modulesAffected.some((m) => m.toLowerCase().includes(q)) ||
        c.filesChanged.some((f) => f.toLowerCase().includes(q)) ||
        c.messageSummary.toLowerCase().includes(q),
    );
  }

  gitContext(query: string) {
    const q = query.toLowerCase();
    const related = this.changes
      .filter(
        (c) =>
          c.messageSummary.toLowerCase().includes(q) ||
          c.filesChanged.some((f) => f.toLowerCase().includes(q)) ||
          c.modulesAffected.some((m) => m.toLowerCase().includes(q)),
      )
      .slice(0, 15);

    const origin = this.blame.origin({ topic: query, changes: this.changes });
    return {
      query,
      changes: related,
      historicalReason: origin.note,
      relatedCommits: related.map((c) => c.commit),
      architectureDecision: origin.relatedDecision,
      origin,
      note: 'Git-derived context — no full patches or secrets stored.',
    };
  }

  changeHistory(module: string) {
    return {
      module,
      history: this.listChanges(module),
      note: 'Module change history from ingested commits.',
    };
  }

  architectureEvolution() {
    return {
      transitions: this.evolution.list(),
      recentArchitectureCommits: this.changes
        .filter((c) => c.changeType === 'ARCHITECTURE')
        .slice(0, 20),
      note: 'Architecture evolution memories from git signals.',
    };
  }

  regressionCheck(input: CommitAnalyzeInput) {
    const change = this.analyzer.analyze(input);
    const matches = this.regressions.check(
      change,
      this.changes,
      input.knownProblemCommits,
    );
    return { change, matches };
  }

  historyContext(question: string) {
    const ctx = this.gitContext(question);
    return {
      question,
      historicalReason: ctx.historicalReason,
      relatedCommits: ctx.relatedCommits,
      architectureDecision: ctx.architectureDecision,
      evidence: ctx.changes.slice(0, 5).map((c) => ({
        commit: c.commit,
        type: c.changeType,
        summary: c.messageSummary,
        decisions: c.relatedDecisions,
        incidents: c.relatedIncidents,
      })),
      timeline: this.timeline.build({
        changes: ctx.changes,
        transitions: this.evolution.list(),
      }),
      note: 'Answers "why is this code like this?" from git knowledge — not people blame.',
    };
  }

  buildTimeline(extra?: {
    decisions?: Array<{ title: string; at?: string; id?: string }>;
    incidents?: Array<{ title: string; at?: string; id?: string }>;
  }) {
    return this.timeline.build({
      changes: this.changes,
      transitions: this.evolution.list(),
      decisions: extra?.decisions,
      incidents: extra?.incidents,
    });
  }
}

export function createGitIntelligence(): GitIntelligence {
  return new GitIntelligence();
}
