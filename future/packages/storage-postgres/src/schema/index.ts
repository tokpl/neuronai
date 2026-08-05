import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const memoryTypeEnum = pgEnum('memory_type', [
  'architecture_decision',
  'knowledge',
  'pattern',
  'mistake',
  'context',
  'business_rule',
  'dependency',
]);

export const memoryStatusEnum = pgEnum('memory_status', ['active', 'archived', 'superseded']);

export const memorySourceEnum = pgEnum('memory_source', [
  'agent',
  'user',
  'git',
  'documentation',
  'manual',
]);

export const relationTypeEnum = pgEnum('relation_type', [
  'depends_on',
  'related_to',
  'replaces',
  'conflicts_with',
  'derived_from',
]);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 128 }).notNull(),
    name: varchar('name', { length: 256 }).notNull(),
    type: varchar('type', { length: 64 }).notNull().default('application'),
    stack: jsonb('stack').$type<string[]>().notNull().default([]),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('projects_slug_uidx').on(table.slug)],
);

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: memoryTypeEnum('type').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    content: text('content').notNull(),
    importanceScore: real('importance_score').notNull(),
    confidenceScore: real('confidence_score').notNull(),
    freshnessScore: real('freshness_score').notNull().default(1),
    source: memorySourceEnum('source').notNull(),
    status: memoryStatusEnum('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    /** Reserved for future pgvector / embedding row linkage */
    embeddingId: uuid('embedding_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memories_project_status_idx').on(table.projectId, table.status),
    index('memories_project_type_idx').on(table.projectId, table.type),
    index('memories_project_importance_idx').on(table.projectId, table.importanceScore),
  ],
);

export const memoryVersions = pgTable(
  'memory_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    content: text('content').notNull(),
    reason: text('reason').notNull(),
    createdBy: memorySourceEnum('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('memory_versions_memory_version_uidx').on(table.memoryId, table.version),
    index('memory_versions_memory_id_idx').on(table.memoryId),
  ],
);

export const memoryRelations = pgTable(
  'memory_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromMemoryId: uuid('from_memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    toMemoryId: uuid('to_memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    relationType: relationTypeEnum('relation_type').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memory_relations_project_idx').on(table.projectId),
    index('memory_relations_from_idx').on(table.fromMemoryId),
    index('memory_relations_to_idx').on(table.toMemoryId),
    uniqueIndex('memory_relations_unique_uidx').on(
      table.fromMemoryId,
      table.toMemoryId,
      table.relationType,
    ),
  ],
);

/**
 * Placeholder table for M2 embeddings (pgvector).
 * Column `embedding` will become vector(N) in a later migration.
 */
export const memoryEmbeddings = pgTable(
  'memory_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    model: varchar('model', { length: 128 }).notNull(),
    dims: integer('dims').notNull(),
    contentHash: varchar('content_hash', { length: 128 }).notNull(),
    /** JSON array placeholder until pgvector migration */
    embeddingJson: jsonb('embedding_json').$type<number[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('memory_embeddings_memory_model_uidx').on(table.memoryId, table.model),
    index('memory_embeddings_project_idx').on(table.projectId),
  ],
);
