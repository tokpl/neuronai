import type { WorkspaceScopedKeys } from '../types.js';

/**
 * Workspace-scoped storage contract.
 * Adapters: memory, file, sqlite (foundation), postgres (foundation).
 * No SaaS multi-tenant cloud DB here.
 */
export interface StorageRecord<T = unknown> {
  id: string;
  workspaceId: string;
  projectId: string;
  collection: string;
  data: T;
  updatedAt: string;
}

export interface StorageQuery {
  workspaceId: string;
  projectId?: string;
  collection?: string;
  limit?: number;
}

export interface StorageProvider {
  readonly name: string;
  save<T>(record: StorageRecord<T>): Promise<void>;
  find<T>(id: string, scope: WorkspaceScopedKeys): Promise<StorageRecord<T> | undefined>;
  query<T>(q: StorageQuery): Promise<Array<StorageRecord<T>>>;
  delete(id: string, scope: WorkspaceScopedKeys): Promise<boolean>;
  migrate(version: number): Promise<{ from: number; to: number }>;
  status(): Promise<StorageStatus>;
}

export interface StorageStatus {
  backend: string;
  ready: boolean;
  recordCount: number;
  note: string;
}

export class MemoryStorageProvider implements StorageProvider {
  readonly name: string = 'memory';
  private records = new Map<string, StorageRecord>();
  private schemaVersion = 0;

  private key(id: string, scope: WorkspaceScopedKeys): string {
    return `${scope.workspaceId}:${scope.projectId}:${id}`;
  }

  async save<T>(record: StorageRecord<T>): Promise<void> {
    this.records.set(this.key(record.id, record), record as StorageRecord);
  }

  async find<T>(
    id: string,
    scope: WorkspaceScopedKeys,
  ): Promise<StorageRecord<T> | undefined> {
    return this.records.get(this.key(id, scope)) as StorageRecord<T> | undefined;
  }

  async query<T>(q: StorageQuery): Promise<Array<StorageRecord<T>>> {
    const out: Array<StorageRecord<T>> = [];
    for (const r of this.records.values()) {
      if (r.workspaceId !== q.workspaceId) continue;
      if (q.projectId && r.projectId !== q.projectId) continue;
      if (q.collection && r.collection !== q.collection) continue;
      out.push(r as StorageRecord<T>);
    }
    return out.slice(0, q.limit ?? 100);
  }

  async delete(id: string, scope: WorkspaceScopedKeys): Promise<boolean> {
    return this.records.delete(this.key(id, scope));
  }

  async migrate(version: number): Promise<{ from: number; to: number }> {
    const from = this.schemaVersion;
    this.schemaVersion = version;
    return { from, to: version };
  }

  async status(): Promise<StorageStatus> {
    return {
      backend: this.name,
      ready: true,
      recordCount: this.records.size,
      note: 'In-memory foundation store (tests / LOCAL).',
    };
  }
}

/**
 * SQLite adapter foundation — interface ready; persistence delegated later.
 * Does not open a real DB file in this milestone.
 */
export class SqliteStorageProvider extends MemoryStorageProvider {
  override readonly name: string = 'sqlite';

  constructor(private readonly databasePath?: string) {
    super();
  }

  override async status(): Promise<StorageStatus> {
    const base = await super.status();
    return {
      ...base,
      backend: this.name,
      note: `SQLite adapter foundation${this.databasePath ? ` @ ${this.databasePath}` : ''} — wire better-sqlite3 in a later milestone.`,
    };
  }
}

/**
 * PostgreSQL adapter foundation — workspace_id / project_id scoped.
 */
export class PostgresStorageProvider extends MemoryStorageProvider {
  override readonly name: string = 'postgres';

  constructor(private readonly databaseUrl?: string) {
    super();
  }

  override async status(): Promise<StorageStatus> {
    const base = await super.status();
    return {
      ...base,
      backend: this.name,
      ready: Boolean(this.databaseUrl),
      note: this.databaseUrl
        ? 'Postgres adapter foundation (URL configured; no public SaaS).'
        : 'Postgres adapter foundation — set DATABASE_URL for self-hosted.',
    };
  }
}

export function createStorageProvider(
  backend: 'memory' | 'sqlite' | 'postgres' | 'file' = 'memory',
  opts?: { databaseUrl?: string; databasePath?: string },
): StorageProvider {
  switch (backend) {
    case 'sqlite':
    case 'file':
      return new SqliteStorageProvider(opts?.databasePath);
    case 'postgres':
      return new PostgresStorageProvider(opts?.databaseUrl);
    default:
      return new MemoryStorageProvider();
  }
}
