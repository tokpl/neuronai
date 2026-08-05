# Future / experimental packages

These packages were removed from the Neuron MVP build.

**MVP product:** local-first AI memory for Cursor (`neuron init` → `.neuron/` → MCP).

Anything here either:
- does not improve “Cursor understands your project” for the default loop, or
- is foundation / enterprise / cloud that we are not shipping yet.

Do **not** add these back to `pnpm-workspace.yaml` without an explicit product decision.

## Contents

| Package | Status |
|---------|--------|
| `storage-postgres` | FUTURE — optional Postgres/pgvector |
| `ai-runtime` | FUTURE — model routing (Neuron is not an AI provider) |
| `workspace-core` | FUTURE — multi-tenant / enterprise |
| `team-brain` / `team-memory` | FUTURE — replaced by Git + versioned `.neuron/` for MVP |
| `*-intelligence` / modes / evaluation / … | FUTURE or EXPERIMENTAL |
| `core-framework` / `sdk` | DELETED from product (archived here) |
| `ops` | MERGED conceptually into CLI file copy (archived) |
| `security-core` | MERGE candidate into `security` later |

SQLite storage remains FUTURE — not implemented.
