import type { EventBus, EventHandler, NeuronEvent, NeuronEventType } from './types.js';

export type { EventBus } from './types.js';

/**
 * In-process event bus (no external broker in MVP).
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly events: NeuronEvent[] = [];
  private readonly maxHistory: number;

  constructor(options: { maxHistory?: number } = {}) {
    this.maxHistory = options.maxHistory ?? 500;
  }

  async publish<TPayload>(event: NeuronEvent<TPayload>): Promise<void> {
    this.events.push(event as NeuronEvent);
    if (this.events.length > this.maxHistory) {
      this.events.splice(0, this.events.length - this.maxHistory);
    }

    const typed = this.handlers.get(event.type);
    const all = this.handlers.get('*');
    const targets = [...(typed ?? []), ...(all ?? [])];
    for (const handler of targets) {
      await handler(event as NeuronEvent);
    }
  }

  subscribe(type: NeuronEventType | '*', handler: EventHandler): () => void {
    const key = type;
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  history(limit = 50): NeuronEvent[] {
    return this.events.slice(-limit);
  }
}

export function createEventBus(options?: { maxHistory?: number }): EventBus {
  return new InMemoryEventBus(options);
}
