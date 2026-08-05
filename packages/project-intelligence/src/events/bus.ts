import type { ProjectEvent, ProjectEventType } from '../types.js';
import { newId, nowIso } from '../types.js';

type Handler = (event: ProjectEvent) => void;

/**
 * In-process project event bus — local only, no network.
 */
export class ProjectEventBus {
  private readonly handlers = new Map<ProjectEventType | '*', Set<Handler>>();
  private readonly history: ProjectEvent[] = [];

  on(type: ProjectEventType | '*', handler: Handler): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  emit(
    type: ProjectEventType,
    input: { path?: string; detail?: string; metadata?: Record<string, unknown> } = {},
  ): ProjectEvent {
    const event: ProjectEvent = {
      id: newId('evt'),
      type,
      at: nowIso(),
      path: input.path,
      detail: input.detail,
      metadata: input.metadata,
    };
    this.history.push(event);
    if (this.history.length > 2_000) this.history.splice(0, this.history.length - 2_000);

    for (const h of this.handlers.get(type) ?? []) h(event);
    for (const h of this.handlers.get('*') ?? []) h(event);
    return event;
  }

  recent(limit = 50): ProjectEvent[] {
    return this.history.slice(-limit).reverse();
  }

  clear(): void {
    this.history.length = 0;
  }
}

export function createProjectEventBus(): ProjectEventBus {
  return new ProjectEventBus();
}
