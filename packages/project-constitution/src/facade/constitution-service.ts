import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { MemoryRecord } from '@neuron-ai-memory/types';

import { createDecisionEvolutionTracker } from '../generators/decision-evolution.js';
import {
  createCursorRulesFromConstitution,
  renderConstitutionMarkdown,
} from '../generators/cursor-rules.js';
import { createMistakeMemorySystem } from '../generators/mistake-memory.js';
import { createPatternMiner } from '../generators/pattern-miner.js';
import { createRuleGenerator } from '../generators/rule-generator.js';
import { suggestBaselineSecurityRules } from '../generators/security-rules.js';
import { createTechnicalDebtMemory } from '../generators/tech-debt.js';
import { createPeriodicReview } from '../evolution/periodic-review.js';
import { createProjectHealthAnalyzer } from '../evolution/project-health.js';
import { createConstitutionRepository } from '../repositories/file-repository.js';
import { createRuleApprovalFlow } from '../validators/approval-flow.js';
import type { ProjectConstitutionDocument } from '../rules/types.js';

export interface ConstitutionServiceOptions {
  neuronDir: string;
  projectId: string;
  projectName: string;
  projectRoot?: string;
}

/**
 * Facade: load/save constitution, suggest rules, health, evolution, Cursor export.
 * Advisor only — never auto-activates CRITICAL rules.
 */
export class ProjectConstitutionService {
  private readonly repo: ReturnType<typeof createConstitutionRepository>;
  private readonly generator = createRuleGenerator();
  private readonly approval = createRuleApprovalFlow();
  private readonly miner = createPatternMiner();
  private readonly mistakes = createMistakeMemorySystem();
  private readonly decisions = createDecisionEvolutionTracker();
  private readonly debt = createTechnicalDebtMemory();
  private readonly health = createProjectHealthAnalyzer();
  private readonly review = createPeriodicReview();

  constructor(private readonly options: ConstitutionServiceOptions) {
    this.repo = createConstitutionRepository(options.neuronDir);
  }

  async load(): Promise<ProjectConstitutionDocument> {
    return this.repo.load(this.options.projectId, this.options.projectName);
  }

  async save(doc: ProjectConstitutionDocument): Promise<void> {
    await this.repo.save(doc);
    await this.repo.saveMarkdown(renderConstitutionMarkdown(doc));
  }

  async getRules(): Promise<{
    document: ProjectConstitutionDocument;
    markdown: string;
    activeCount: number;
    suggestedCount: number;
  }> {
    const document = await this.load();
    return {
      document,
      markdown: renderConstitutionMarkdown(document, { includeSuggested: true }),
      activeCount: document.rules.filter((r) => r.status === 'active').length,
      suggestedCount: document.rules.filter((r) => r.status === 'suggested').length,
    };
  }

  async suggestRules(memories: MemoryRecord[], fileNames: string[] = []) {
    let doc = await this.load();
    doc = this.mistakes.fromMemories(doc, memories);
    doc = this.decisions.syncFromMemories(doc, memories);
    doc = this.debt.fromMemories(doc, memories);

    const fromMemories = this.generator.fromMemories(memories);
    const patterns = this.miner.mine(fileNames);
    const fromPatterns = patterns.map((p) =>
      this.generator.fromRepeatedPattern(p.name, p.count, p.examples),
    );

    const added = [];
    for (const s of [...fromMemories, ...fromPatterns]) {
      doc = this.approval.suggest(doc, s.rule);
      added.push({ rule: s.rule, evidence: s.evidence });
    }

    await this.save(doc);
    return { document: doc, suggestions: added, patterns };
  }

  /** Suggest baseline SECURITY constitution rules (human must accept). */
  async suggestSecurityRules() {
    let doc = await this.load();
    const { document, added } = suggestBaselineSecurityRules(doc);
    doc = document;
    await this.save(doc);
    return { document: doc, suggestions: added };
  }

  async acceptRule(ruleId: string, asCritical = false) {
    let doc = await this.load();
    doc = this.approval.accept(doc, ruleId, { asCritical });
    await this.save(doc);
    return doc;
  }

  async rejectRule(ruleId: string) {
    let doc = await this.load();
    doc = this.approval.reject(doc, ruleId);
    await this.save(doc);
    return doc;
  }

  async projectHealth(memories: MemoryRecord[]) {
    const doc = await this.load();
    return this.health.analyze(doc, memories);
  }

  async reviewEvolution(input: {
    commitsSinceReview?: number;
    fileNames?: string[];
  } = {}) {
    const doc = await this.load();
    const patterns = this.miner.mine(input.fileNames ?? []);
    return this.review.evaluate(doc, {
      commitsSinceReview: input.commitsSinceReview ?? doc.commitsSinceReview ?? 0,
      newPatternSummaries: patterns.map((p) => p.summary),
    });
  }

  async generateCursorRules(): Promise<{ path: string; content: string; ruleCount: number }> {
    const doc = await this.load();
    const file = createCursorRulesFromConstitution(doc);
    const root = this.options.projectRoot ?? dirname(this.options.neuronDir);
    const abs = join(root, '.cursor', file.relativePath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, file.content, 'utf8');
    return {
      path: abs,
      content: file.content,
      ruleCount: doc.rules.filter((r) => r.status === 'active').length,
    };
  }

  async recordMistake(input: { title: string; detail: string; relatedModule?: string }) {
    let doc = await this.load();
    doc = this.mistakes.recordCorrection(doc, input);
    await this.save(doc);
    return doc;
  }

  async evolveDecision(input: { title: string; newState: string; reason: string }) {
    let doc = await this.load();
    doc = this.decisions.evolve(doc, input);
    await this.save(doc);
    return doc;
  }
}

export function createProjectConstitutionService(
  options: ConstitutionServiceOptions,
): ProjectConstitutionService {
  return new ProjectConstitutionService(options);
}
