import { createNeuronEvent, type NeuronEvent } from './types.js';

export interface AgentStartedTaskPayload {
  task: string;
  files?: string[];
}

export interface CodeChangedPayload {
  diff?: string;
  files?: string[];
  summary?: string;
}

export interface FilePathPayload {
  path: string;
}

export interface GitCommittedPayload {
  message: string;
  hash?: string;
  branch?: string;
  files?: string[];
  diff?: string;
}

export interface PullRequestCreatedPayload {
  title: string;
  body?: string;
  branch?: string;
}

export interface ArchitectureChangedPayload {
  description: string;
  modules?: string[];
}

export interface DocumentationChangedPayload {
  paths: string[];
  summary?: string;
}

export interface TaskCompletedPayload {
  task: string;
  summary?: string;
  diff?: string;
  files?: string[];
  commitMessage?: string;
}

export const DomainEvents = {
  projectOpened(projectId: string, rootPath: string): NeuronEvent {
    return createNeuronEvent({
      type: 'ProjectOpened',
      projectId,
      source: 'system',
      payload: { rootPath },
    });
  },

  agentStartedTask(
    projectId: string,
    payload: AgentStartedTaskPayload,
    source: 'agent' | 'mcp' | 'cli' = 'agent',
  ): NeuronEvent<AgentStartedTaskPayload> {
    return createNeuronEvent({ type: 'AgentStartedTask', projectId, source, payload });
  },

  codeChanged(
    projectId: string,
    payload: CodeChangedPayload,
    source: 'agent' | 'ide' | 'git' | 'mcp' = 'agent',
  ): NeuronEvent<CodeChangedPayload> {
    return createNeuronEvent({ type: 'CodeChanged', projectId, source, payload });
  },

  fileCreated(projectId: string, path: string): NeuronEvent<FilePathPayload> {
    return createNeuronEvent({
      type: 'FileCreated',
      projectId,
      source: 'ide',
      payload: { path },
    });
  },

  fileDeleted(projectId: string, path: string): NeuronEvent<FilePathPayload> {
    return createNeuronEvent({
      type: 'FileDeleted',
      projectId,
      source: 'ide',
      payload: { path },
    });
  },

  gitCommitted(
    projectId: string,
    payload: GitCommittedPayload,
  ): NeuronEvent<GitCommittedPayload> {
    return createNeuronEvent({ type: 'GitCommitted', projectId, source: 'git', payload });
  },

  pullRequestCreated(
    projectId: string,
    payload: PullRequestCreatedPayload,
  ): NeuronEvent<PullRequestCreatedPayload> {
    return createNeuronEvent({ type: 'PullRequestCreated', projectId, source: 'git', payload });
  },

  architectureChanged(
    projectId: string,
    payload: ArchitectureChangedPayload,
  ): NeuronEvent<ArchitectureChangedPayload> {
    return createNeuronEvent({
      type: 'ArchitectureChanged',
      projectId,
      source: 'agent',
      payload,
    });
  },

  documentationChanged(
    projectId: string,
    payload: DocumentationChangedPayload,
  ): NeuronEvent<DocumentationChangedPayload> {
    return createNeuronEvent({
      type: 'DocumentationChanged',
      projectId,
      source: 'ide',
      payload,
    });
  },

  taskCompleted(
    projectId: string,
    payload: TaskCompletedPayload,
    source: 'agent' | 'mcp' | 'cli' = 'agent',
  ): NeuronEvent<TaskCompletedPayload> {
    return createNeuronEvent({ type: 'TaskCompleted', projectId, source, payload });
  },
};
