import type { MemorySuggestion } from '../suggestion/memory-suggestion-engine.js';
import type { CodeChangeAnalysis } from '../analysis/code-change-analyzer.js';

export interface HookContext {
  projectId: string;
  task?: string;
  cwd?: string;
}

export interface BeforeTaskHookInput extends HookContext {
  task: string;
  files?: string[];
}

export interface AfterTaskHookInput extends HookContext {
  task: string;
  summary?: string;
  analysis?: CodeChangeAnalysis;
  suggestion?: MemorySuggestion;
}

export interface BeforeCommitHookInput extends HookContext {
  message: string;
  files?: string[];
  diff?: string;
}

export interface AfterCommitHookInput extends HookContext {
  message: string;
  hash?: string;
  analysis?: CodeChangeAnalysis;
  suggestion?: MemorySuggestion;
}

export interface BeforeTaskHook {
  name: string;
  run(input: BeforeTaskHookInput): Promise<void> | void;
}

export interface AfterTaskHook {
  name: string;
  run(input: AfterTaskHookInput): Promise<void> | void;
}

export interface BeforeCommitHook {
  name: string;
  run(input: BeforeCommitHookInput): Promise<void> | void;
}

export interface AfterCommitHook {
  name: string;
  run(input: AfterCommitHookInput): Promise<void> | void;
}

export interface HookRegistry {
  beforeTask: BeforeTaskHook[];
  afterTask: AfterTaskHook[];
  beforeCommit: BeforeCommitHook[];
  afterCommit: AfterCommitHook[];
}

export function createHookRegistry(): HookRegistry {
  return {
    beforeTask: [],
    afterTask: [],
    beforeCommit: [],
    afterCommit: [],
  };
}

export async function runHooks<T>(
  hooks: Array<{ name: string; run: (input: T) => Promise<void> | void }>,
  input: T,
): Promise<void> {
  for (const hook of hooks) {
    await hook.run(input);
  }
}
