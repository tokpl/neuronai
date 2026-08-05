# Storage abstraction

`StorageProvider` is workspace-scoped — never assume a single global database.

## Interface

```ts
save / find / query / delete / migrate / status
```

Every record carries:

- `workspace_id`
- `project_id`
- `collection`

## Backends (foundation)

| Backend | Status |
|---------|--------|
| `memory` | In-process (tests / LOCAL) |
| `sqlite` / `file` | Adapter foundation |
| `postgres` | Adapter foundation (`DATABASE_URL`) |

Full Postgres wiring continues to live in `@neuron-ai-memory/storage` for memory repos; workspace-core defines the **enterprise-shaped** contract.

## Out of scope

- SaaS multi-tenant cloud DB
- Billing-tied storage quotas
