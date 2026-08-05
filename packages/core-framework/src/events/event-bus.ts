import type { NeuronEvent, NeuronEventType } from '../types.js';
import { nowIso } from '../types.js';

export type EventHandler<T = unknown> = (event: NeuronEvent<T>) => void | Promise<void>;

/**
 * Internal event bus — modules communicate without knowing each other.
 * Not a public plugin hook system.
 */
export class NeuronEventBus {
  private readonly handlers = new Map<NeuronEventType | '*', Set<EventHandler>>();

  on<T = unknown>(type: NeuronEventType | '*', handler: EventHandler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as EventHandler);
    this.handlers.set(type, set);
    return () => set.delete(handler as EventHandler);
  }

  async emit<T = unknown>(
    type: NeuronEventType,
    payload: T,
    module: NeuronEvent['module'] = 'core',
  ): Promise<NeuronEvent<T>> {
    const event: NeuronEvent<T> = { type, module, payload, at: nowIso() };
    const specific = this.handlers.get(type);
    const all = this.handlers.get('*');
    const list = [...(specific ?? []), ...(all ?? [])];
    for (const h of list) {
      await h(event as NeuronEvent);
    }
    return event;
  }

  clear(): void {
    this.handlers.clear();
  }

  listenerCount(type?: NeuronEventType | '*'): number {
    if (type) return this.handlers.get(type)?.size ?? 0;
    let n = 0;
    for (const s of this.handlers.values()) n += s.size;
    return n;
  }
}

export function createNeuronEventBus(): NeuronEventBus {
  return new NeuronEventBus();
}
