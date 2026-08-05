import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { StorageError } from '@neuron-ai-memory/types';

import * as schema from '../schema/index.js';

export type NeuronDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseClient {
  db: NeuronDatabase;
  sql: ReturnType<typeof postgres>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface CreateDbClientOptions {
  connectionString?: string;
}

export function requireDatabaseUrl(explicit?: string): string {
  const url = explicit ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new StorageError('DATABASE_URL is not set');
  }
  return url;
}

export function createDbClient(options: CreateDbClientOptions = {}): DatabaseClient {
  const connectionString = requireDatabaseUrl(options.connectionString);
  const sql = postgres(connectionString, { max: 10 });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    async ping(): Promise<void> {
      await sql`select 1`;
    },
    async close(): Promise<void> {
      await sql.end({ timeout: 5 });
    },
  };
}
