import type { MemoryEngine } from '@neuronai/memory-engine';
import type { MemoryRecord } from '@neuronai/types';

import {
  CodeChangeAnalyzer,
  type CodeChangeAnalysis,
} from '../analysis/code-change-analyzer.js';
import { DomainEvents } from '../events/domain-events.js';
import { createEventBus, type EventBus } from '../events/event-bus.js';
import type { NeuronEvent } from '../events/types.js';
import {
  createHookRegistry,
  runHooks,
  type HookRegistry,
} from '../hooks/hook-interfaces.js';
import {
  createPrivacyPolicy,
  shouldAutoPersist,
  shouldEmitSuggestion,
  type PrivacyMode,
  type PrivacyPolicy,
} from '../privacy/privacy-mode.js';
import {
  createMemoryQualityChecker,
  type MemoryQualityChecker,
  type QualityCheckResult,
} from '../quality/memory-quality-checker.js';
import {
  createMemorySuggestionEngine,
  type MemorySuggestion,
  type MemorySuggestionEngine,
} from '../suggestion/memory-suggestion-engine.js';

export interface AgentTaskSession {
  projectId: string;
  task: string;
  startedAt: string;
  events: NeuronEvent[];
}

export interface AfterCodingResult {
  analysis: CodeChangeAnalysis;
  suggestion: MemorySuggestion | null;
  quality: QualityCheckResult | null;
  persisted: MemoryRecord | null;
  promptText: string | null;
}

export interface AgentWorkflowDeps {
  projectId: string;
  privacy?: PrivacyMode | PrivacyPolicy;
  eventBus?: EventBus;
  hooks?: HookRegistry;
  engine?: MemoryEngine;
  suggestionEngine?: MemorySuggestionEngine;
  qualityChecker?: MemoryQualityChecker;
  changeAnalyzer?: CodeChangeAnalyzer;
  listExistingMemories?: () => Promise<MemoryRecord[]>;
}

/**
 * Orchestrates before/during/after coding workflow for agents.
 */
export class AgentWorkflowOrchestrator {
  readonly eventBus: EventBus;
  readonly hooks: HookRegistry;
  readonly privacy: PrivacyPolicy;
  private readonly analyzer: CodeChangeAnalyzer;
  private readonly suggestions: MemorySuggestionEngine;
  private readonly quality: MemoryQualityChecker;
  private readonly engine?: MemoryEngine;
  private readonly listExisting: () => Promise<MemoryRecord[]>;
  private session: AgentTaskSession | null = null;

  constructor(private readonly deps: AgentWorkflowDeps) {
    this.eventBus = deps.eventBus ?? createEventBus();
    this.hooks = deps.hooks ?? createHookRegistry();
    this.privacy =
      typeof deps.privacy === 'string' || deps.privacy === undefined
        ? createPrivacyPolicy(deps.privacy ?? 'suggest')
        : deps.privacy;
    this.analyzer = deps.changeAnalyzer ?? new CodeChangeAnalyzer();
    this.suggestions = deps.suggestionEngine ?? createMemorySuggestionEngine();
    this.quality = deps.qualityChecker ?? createMemoryQualityChecker();
    this.engine = deps.engine;
    this.listExisting = deps.listExistingMemories ?? (async () => []);
  }

  getCurrentSession(): AgentTaskSession | null {
    return this.session;
  }

  /** Before coding: publish task start + run before hooks. */
  async beforeCoding(input: { task: string; files?: string[] }): Promise<AgentTaskSession> {
    const event = DomainEvents.agentStartedTask(this.deps.projectId, {
      task: input.task,
      files: input.files,
    });
    await this.eventBus.publish(event);
    await runHooks(this.hooks.beforeTask, {
      projectId: this.deps.projectId,
      task: input.task,
      files: input.files,
    });

    const session: AgentTaskSession = {
      projectId: this.deps.projectId,
      task: input.task,
      startedAt: event.timestamp,
      events: [event as NeuronEvent],
    };
    this.session = session;
    return session;
  }

  /** During coding: ingest a development event. */
  async ingest(event: NeuronEvent): Promise<void> {
    await this.eventBus.publish(event);
    if (this.session) this.session.events.push(event);
  }

  /**
   * After coding: analyze changes → suggest → optional auto-save (privacy).
   */
  async afterCoding(input: {
    task?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    commitMessage?: string;
  }): Promise<AfterCodingResult> {
    const task = input.task ?? this.session?.task ?? 'untitled task';
    const analysis = this.analyzer.analyze({
      diff: input.diff,
      files: input.files,
      message: input.commitMessage ?? input.summary,
    });

    await this.eventBus.publish(
      DomainEvents.taskCompleted(this.deps.projectId, {
        task,
        summary: input.summary,
        diff: input.diff,
        files: input.files,
        commitMessage: input.commitMessage,
      }),
    );

    if (!shouldEmitSuggestion(this.privacy)) {
      await runHooks(this.hooks.afterTask, {
        projectId: this.deps.projectId,
        task,
        summary: input.summary,
        analysis,
      });
      return {
        analysis,
        suggestion: null,
        quality: null,
        persisted: null,
        promptText: null,
      };
    }

    const suggestion = this.suggestions.suggest({
      analysis,
      commitMessage: input.commitMessage,
      task,
    });

    let quality: QualityCheckResult | null = null;
    let persisted: MemoryRecord | null = null;

    if (suggestion.shouldSuggest) {
      const existing = await this.listExisting();
      quality = this.quality.check({
        title: suggestion.title,
        content: suggestion.draftContent,
        type: suggestion.type,
        confidence: suggestion.confidence,
        existing,
      });

      if (
        shouldAutoPersist(this.privacy, suggestion.confidence, quality.recommendation === 'accept') &&
        this.engine
      ) {
        persisted = await this.engine.createMemory({
          projectId: this.deps.projectId,
          type: suggestion.type,
          title: suggestion.title,
          content: suggestion.draftContent,
          source: 'agent',
          tags: ['auto-capture', ...analysis.signals],
          manualImportance: suggestion.confidence,
          confidence: suggestion.confidence,
        });
      }
    }

    await runHooks(this.hooks.afterTask, {
      projectId: this.deps.projectId,
      task,
      summary: input.summary,
      analysis,
      suggestion,
    });

    return {
      analysis,
      suggestion: suggestion.shouldSuggest ? suggestion : null,
      quality,
      persisted,
      promptText: suggestion.shouldSuggest ? suggestion.prompt.text : null,
    };
  }

  async beforeCommit(input: {
    message: string;
    files?: string[];
    diff?: string;
  }): Promise<MemorySuggestion | null> {
    await runHooks(this.hooks.beforeCommit, {
      projectId: this.deps.projectId,
      message: input.message,
      files: input.files,
      diff: input.diff,
    });

    if (!shouldEmitSuggestion(this.privacy)) return null;

    const analysis = this.analyzer.analyze({
      diff: input.diff,
      files: input.files,
      message: input.message,
    });
    const suggestion = this.suggestions.suggest({
      analysis,
      commitMessage: input.message,
    });
    return suggestion.shouldSuggest ? suggestion : null;
  }

  async afterCommit(input: {
    message: string;
    hash?: string;
    files?: string[];
    diff?: string;
  }): Promise<AfterCodingResult> {
    await this.eventBus.publish(
      DomainEvents.gitCommitted(this.deps.projectId, {
        message: input.message,
        hash: input.hash,
        files: input.files,
        diff: input.diff,
      }),
    );

    const result = await this.afterCoding({
      commitMessage: input.message,
      files: input.files,
      diff: input.diff,
      summary: input.message,
    });

    await runHooks(this.hooks.afterCommit, {
      projectId: this.deps.projectId,
      message: input.message,
      hash: input.hash,
      analysis: result.analysis,
      suggestion: result.suggestion ?? undefined,
    });

    return result;
  }
}

export function createAgentWorkflow(deps: AgentWorkflowDeps): AgentWorkflowOrchestrator {
  return new AgentWorkflowOrchestrator(deps);
}
