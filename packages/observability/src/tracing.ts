/**
 * Tracing abstraction - wire OpenTelemetry later without changing call sites.
 */
export interface Span {
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
}

export interface Tracer {
  startSpan(name: string): Span;
}

class NoopSpan implements Span {
  end(): void {}
  setAttribute(): void {}
}

export class NoopTracer implements Tracer {
  startSpan(): Span {
    return new NoopSpan();
  }
}

let activeTracer: Tracer = new NoopTracer();

export function setTracer(tracer: Tracer): void {
  activeTracer = tracer;
}

export function getTracer(): Tracer {
  return activeTracer;
}
