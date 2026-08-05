export type MetricName =
  | 'memories.created'
  | 'memories.searches'
  | 'memories.retrieval_quality'
  | 'errors.total'
  | 'mcp.tool_calls';

/**
 * In-process metrics counter (export later to Prometheus / OTel).
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();

  incr(name: MetricName, by = 1, labels: Record<string, string> = {}): void {
    const key = `${name}|${JSON.stringify(labels)}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  get(name: MetricName, labels: Record<string, string> = {}): number {
    return this.counters.get(`${name}|${JSON.stringify(labels)}`) ?? 0;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters.entries());
  }
}

export const globalMetrics = new MetricsRegistry();
