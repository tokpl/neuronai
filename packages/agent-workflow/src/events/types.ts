import { randomUUID } from 'node:crypto';

/** Neuron development-process events (not chat logs). */
export type NeuronEventType =
  | 'ProjectOpened'
  | 'AgentStartedTask'
  | 'CodeChanged'
  | 'FileCreated'
  | 'FileDeleted'
  | 'GitCommitted'
  | 'PullRequestCreated'
  | 'ArchitectureChanged'
  | 'DocumentationChanged'
  | 'TaskCompleted';

export type NeuronEventSource =
  | 'agent'
  | 'cli'
  | 'git'
  | 'ide'
  | 'mcp'
  | 'hook'
  | 'system';

export interface NeuronEvent<TPayload = unknown> {
  id: string;
  type: NeuronEventType;
  projectId: string;
  source: NeuronEventSource;
  payload: TPayload;
  timestamp: string;
}

export type EventHandler<TPayload = unknown> = (
  event: NeuronEvent<TPayload>,
) => void | Promise<void>;

export interface EventBus {
  publish<TPayload>(event: NeuronEvent<TPayload>): Promise<void>;
  subscribe(type: NeuronEventType | '*', handler: EventHandler): () => void;
  history(limit?: number): NeuronEvent[];
}

export function createNeuronEvent<TPayload>(input: {
  type: NeuronEventType;
  projectId: string;
  source: NeuronEventSource;
  payload: TPayload;
  id?: string;
  timestamp?: string;
}): NeuronEvent<TPayload> {
  return {
    id: input.id ?? randomUUID(),
    type: input.type,
    projectId: input.projectId,
    source: input.source,
    payload: input.payload,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}
