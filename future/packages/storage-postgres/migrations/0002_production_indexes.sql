-- Neuron AI Memory — production indexes & maintenance helpers (M8)
-- Apply after 0001_memory_core.sql

-- Hot-path search / context retrieval
CREATE INDEX IF NOT EXISTS memories_project_updated_idx
  ON memories (project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS memories_project_last_used_idx
  ON memories (project_id, last_used_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS memories_active_importance_idx
  ON memories (project_id, importance_score DESC)
  WHERE status = 'active';

-- Tag containment queries (jsonb)
CREATE INDEX IF NOT EXISTS memories_tags_gin_idx
  ON memories USING gin (tags);

-- Version history lookups
CREATE INDEX IF NOT EXISTS memory_versions_memory_version_idx
  ON memory_versions (memory_id, version DESC);

-- Relation graph traversals
CREATE INDEX IF NOT EXISTS memory_relations_from_idx
  ON memory_relations (project_id, from_memory_id);

CREATE INDEX IF NOT EXISTS memory_relations_to_idx
  ON memory_relations (project_id, to_memory_id);

-- Optional: archive candidates (stale + low importance)
-- SELECT id FROM memories
-- WHERE status = 'active'
--   AND importance_score < 0.5
--   AND COALESCE(last_used_at, updated_at) < now() - interval '180 days';

-- Rollback note: drop indexes created above if needed.
-- DROP INDEX IF EXISTS memories_project_updated_idx;
-- ... etc.
