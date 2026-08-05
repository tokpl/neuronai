import type { MemoryEngine } from '@neuron-ai-memory/memory-engine';
import type { MemoryRecord, MemorySource } from '@neuron-ai-memory/types';
import type { AIProvider } from '@neuron-ai-memory/ai-provider';

import { MemoryClassifier } from '../classifier/memory-classifier.js';
import { ConflictDetector, type ConflictReport } from '../conflict/conflict-detector.js';
import { MemoryExtractor, type ExtractedMemoryCandidate } from '../extractor/memory-extractor.js';
import { ImportanceEngine, type ImportanceDecision } from '../importance/importance-engine.js';
import type { MemorySearchEngine } from '../search/memory-search-engine.js';

export type RawMemoryInputKind =
  'conversation' | 'diff' | 'commit' | 'documentation' | 'agent_action';

export interface RawMemoryInput {
  projectId: string;
  text: string;
  kind: RawMemoryInputKind;
  source?: MemorySource;
  context?: string;
  /** When true, ask_user candidates are still persisted (tests / trusted mode). */
  autoPersistAskUser?: boolean;
}

export interface PipelineCandidateResult {
  candidate: ExtractedMemoryCandidate;
  importance: ImportanceDecision;
  conflict: ConflictReport;
  memory?: MemoryRecord;
  status: 'stored' | 'skipped' | 'needs_review' | 'superseded_existing';
}

export interface MemoryIntelligenceResult {
  results: PipelineCandidateResult[];
}

export interface MemoryIntelligencePipelineDeps {
  engine: MemoryEngine;
  ai?: AIProvider;
  searchEngine?: MemorySearchEngine;
}

/**
 * End-to-end: raw signal → extract → classify → score → conflict → Memory Core.
 */
export class MemoryIntelligencePipeline {
  private readonly classifier: MemoryClassifier;
  private readonly extractor: MemoryExtractor;
  private readonly importance = new ImportanceEngine();
  private readonly conflicts = new ConflictDetector();

  constructor(private readonly deps: MemoryIntelligencePipelineDeps) {
    this.classifier = new MemoryClassifier(deps.ai);
    this.extractor = new MemoryExtractor(this.classifier, deps.ai);
  }

  async process(input: RawMemoryInput): Promise<MemoryIntelligenceResult> {
    if (this.deps.ai) {
      await this.deps.ai.analyze(input.text, input.context);
    }

    const extracted = await this.extractor.extract({
      text: input.text,
      source: mapSource(input),
      context: input.context,
    });

    const existing = await loadActiveMemories(this.deps.engine, input.projectId);
    const results: PipelineCandidateResult[] = [];

    for (const candidate of extracted) {
      const importance = this.importance.score({
        type: candidate.type,
        content: candidate.content,
        source: candidate.sourceHint ?? mapSource(input),
        confidence: candidate.confidence,
      });

      const conflict = this.conflicts.detect(candidate, existing);
      const outcome = await this.persistCandidate({
        input,
        candidate,
        importance,
        conflict,
      });
      results.push(outcome);

      if (outcome.memory) {
        existing.push(outcome.memory);
        if (this.deps.searchEngine) {
          await this.deps.searchEngine.indexMemory(outcome.memory);
        }
      }
    }

    return { results };
  }

  private async persistCandidate(args: {
    input: RawMemoryInput;
    candidate: ExtractedMemoryCandidate;
    importance: ImportanceDecision;
    conflict: ConflictReport;
  }): Promise<PipelineCandidateResult> {
    const { input, candidate, importance, conflict } = args;

    if (importance.action === 'reject') {
      return { candidate, importance, conflict, status: 'skipped' };
    }

    if (conflict.recommendation === 'skip') {
      return { candidate, importance, conflict, status: 'skipped' };
    }

    if (conflict.recommendation === 'ask_user' && !input.autoPersistAskUser) {
      return { candidate, importance, conflict, status: 'needs_review' };
    }

    if (
      importance.action === 'ask_user' &&
      !input.autoPersistAskUser &&
      conflict.recommendation !== 'supersede'
    ) {
      return { candidate, importance, conflict, status: 'needs_review' };
    }

    if (conflict.recommendation === 'supersede' && conflict.existing) {
      await this.deps.engine.archiveMemory(conflict.existing.id);
      const memory = await this.deps.engine.createMemory({
        projectId: input.projectId,
        type: candidate.type,
        title: candidate.title,
        content: formatContent(candidate),
        source: candidate.sourceHint ?? mapSource(input),
        manualImportance: importance.score,
        confidence: candidate.confidence,
        tags: [`supersedes:${conflict.existing.id}`],
      });
      return {
        candidate,
        importance,
        conflict,
        memory,
        status: 'superseded_existing',
      };
    }

    const memory = await this.deps.engine.createMemory({
      projectId: input.projectId,
      type: candidate.type,
      title: candidate.title,
      content: formatContent(candidate),
      source: candidate.sourceHint ?? mapSource(input),
      manualImportance: importance.score,
      confidence: candidate.confidence,
    });

    return {
      candidate,
      importance,
      conflict,
      memory,
      status: 'stored',
    };
  }
}

export function createMemoryIntelligencePipeline(
  deps: MemoryIntelligencePipelineDeps,
): MemoryIntelligencePipeline {
  return new MemoryIntelligencePipeline(deps);
}

function mapSource(input: RawMemoryInput): MemorySource {
  if (input.source) return input.source;
  switch (input.kind) {
    case 'commit':
    case 'diff':
      return 'git';
    case 'documentation':
      return 'documentation';
    case 'conversation':
      return 'user';
    case 'agent_action':
      return 'agent';
    default:
      return 'agent';
  }
}

function formatContent(candidate: ExtractedMemoryCandidate): string {
  if (candidate.reason) {
    return `${candidate.content}\n\nReason: ${candidate.reason}`;
  }
  return candidate.content;
}

async function loadActiveMemories(
  engine: MemoryEngine,
  projectId: string,
): Promise<MemoryRecord[]> {
  const ctx = await engine.getProjectMemoryContext({
    projectId,
    limit: 100,
    maxTokens: 100_000,
  });
  return ctx.memories;
}
