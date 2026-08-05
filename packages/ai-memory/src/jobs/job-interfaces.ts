/**
 * Background job contracts (no queue implementation yet).
 * Wire to pg-boss / BullMQ / in-process workers in a later milestone.
 */

export type MemoryJobType =
  'memory.extraction' | 'memory.embedding' | 'memory.consolidation' | 'memory.cleanup';

export interface MemoryJob<TPayload = unknown> {
  id: string;
  type: MemoryJobType;
  projectId: string;
  payload: TPayload;
  createdAt: string;
}

export interface MemoryJobHandler<TPayload = unknown> {
  readonly type: MemoryJobType;
  handle(job: MemoryJob<TPayload>): Promise<void>;
}

export interface MemoryJobQueue {
  enqueue<TPayload>(job: Omit<MemoryJob<TPayload>, 'id' | 'createdAt'>): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(handler: MemoryJobHandler<any>): void;
}

/** No-op queue that records enqueued jobs for tests. */
export class InMemoryJobQueue implements MemoryJobQueue {
  readonly jobs: MemoryJob[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly handlers = new Map<MemoryJobType, MemoryJobHandler<any>>();

  async enqueue<TPayload>(job: Omit<MemoryJob<TPayload>, 'id' | 'createdAt'>): Promise<string> {
    const id = `job_${this.jobs.length + 1}`;
    const full: MemoryJob<TPayload> = {
      ...job,
      id,
      createdAt: new Date().toISOString(),
    };
    this.jobs.push(full as MemoryJob);
    const handler = this.handlers.get(job.type);
    if (handler) {
      await handler.handle(full);
    }
    return id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(handler: MemoryJobHandler<any>): void {
    this.handlers.set(handler.type, handler);
  }
}
