export type ObservabilityEventType =
  | 'trace.recorded'
  | 'debug.enabled'
  | 'debug.disabled'
  | 'retention.changed'
  | 'metrics.snapshot'
  | 'error.analyzed';

export interface ObservabilityEvent {
  type: ObservabilityEventType;
  at: string;
  payload?: Record<string, unknown>;
}

type Listener = (event: ObservabilityEvent) => void;

/** In-process event bus for observability (no remote fan-out). */
export class ObservabilityEventBus {
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ObservabilityEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        /* never break callers */
      }
    }
  }
}

export function createObservabilityEventBus(): ObservabilityEventBus {
  return new ObservabilityEventBus();
}
