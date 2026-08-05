import type { MemoryRecord } from '@neuron-ai-memory/types';

export type DomainEventName =
  | 'memory.created'
  | 'memory.updated'
  | 'memory.archived'
  | 'memory.version_created'
  | 'memory.relation_created';

export interface DomainEvent<TName extends DomainEventName = DomainEventName, TPayload = unknown> {
  name: TName;
  occurredAt: string;
  payload: TPayload;
}

export type MemoryCreatedEvent = DomainEvent<'memory.created', { memory: MemoryRecord }>;

export type MemoryUpdatedEvent = DomainEvent<
  'memory.updated',
  { memory: MemoryRecord; previousVersion: number }
>;

export type MemoryArchivedEvent = DomainEvent<
  'memory.archived',
  { memoryId: string; projectId: string }
>;

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void> | void;
}

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.events.push(event);
  }
}
