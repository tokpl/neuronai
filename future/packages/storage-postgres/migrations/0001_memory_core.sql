-- Neuron AI Memory — initial Memory Core schema (M1)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM (
    'architecture_decision',
    'knowledge',
    'pattern',
    'mistake',
    'context',
    'business_rule',
    'dependency'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_status AS ENUM ('active', 'archived', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_source AS ENUM ('agent', 'user', 'git', 'documentation', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE relation_type AS ENUM (
    'depends_on',
    'related_to',
    'replaces',
    'conflicts_with',
    'derived_from'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(128) NOT NULL,
  name varchar(256) NOT NULL,
  type varchar(64) NOT NULL DEFAULT 'application',
  stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_uidx ON projects (slug);

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type memory_type NOT NULL,
  title varchar(512) NOT NULL,
  content text NOT NULL,
  importance_score real NOT NULL,
  confidence_score real NOT NULL,
  freshness_score real NOT NULL DEFAULT 1,
  source memory_source NOT NULL,
  status memory_status NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  embedding_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memories_project_status_idx ON memories (project_id, status);
CREATE INDEX IF NOT EXISTS memories_project_type_idx ON memories (project_id, type);
CREATE INDEX IF NOT EXISTS memories_project_importance_idx ON memories (project_id, importance_score);

CREATE TABLE IF NOT EXISTS memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title varchar(512) NOT NULL,
  content text NOT NULL,
  reason text NOT NULL,
  created_by memory_source NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_versions_memory_version_uidx
  ON memory_versions (memory_id, version);
CREATE INDEX IF NOT EXISTS memory_versions_memory_id_idx ON memory_versions (memory_id);

CREATE TABLE IF NOT EXISTS memory_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  to_memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  relation_type relation_type NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_relations_project_idx ON memory_relations (project_id);
CREATE INDEX IF NOT EXISTS memory_relations_from_idx ON memory_relations (from_memory_id);
CREATE INDEX IF NOT EXISTS memory_relations_to_idx ON memory_relations (to_memory_id);
CREATE UNIQUE INDEX IF NOT EXISTS memory_relations_unique_uidx
  ON memory_relations (from_memory_id, to_memory_id, relation_type);

-- Placeholder for M2 pgvector embeddings
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  model varchar(128) NOT NULL,
  dims integer NOT NULL,
  content_hash varchar(128) NOT NULL,
  embedding_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_embeddings_memory_model_uidx
  ON memory_embeddings (memory_id, model);
CREATE INDEX IF NOT EXISTS memory_embeddings_project_idx ON memory_embeddings (project_id);
