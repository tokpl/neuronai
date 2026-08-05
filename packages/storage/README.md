# @neuronai/storage

PostgreSQL persistence for Neuron Memory Core.

## Contents

- Drizzle schema (`src/schema`)
- SQL migration `migrations/0001_memory_core.sql`
- Postgres repository adapters implementing memory-engine ports
- `createPostgresMemoryStack()` helper

## Migrate

```bash
# from repo root
pnpm docker:up
cp .env.example .env
pnpm db:migrate
```

## DB tests

Integration tests run only when:

```bash
NEURON_RUN_DB_TESTS=1 DATABASE_URL=postgresql://neuron:neuron@localhost:5432/neuron pnpm --filter @neuronai/storage test
```
