# Team memory (SharedMemory)

## Types

| Type | Use |
|------|-----|
| ARCHITECTURE_DECISION | ADR-style choices |
| PROJECT_RULE | Team conventions |
| INCIDENT | Postmortems / mistakes |
| PATTERN | Preferred patterns |
| DOCUMENTATION | Living notes |
| SECURITY_RULE | Security standards |

## Fields

`owner`, `contributors`, `visibility`, `confidence`, `history`, `ownership` (creator / source / approvedBy)

## Approval

```text
DRAFT → REVIEW → APPROVED → ARCHIVED
```

Not every fact auto-publishes. Suggest requires **SUGGEST**; approve requires **APPROVE**.

## Ownership example

```text
Decision: Use PostgreSQL
Created by: Senior Developer
Approved by: Team (reviewer)
Source: team-brain
```

## Conflicts

`TeamKnowledgeConflictResolver` surfaces competing proposals (REST vs GraphQL) with arguments, history, and current standard.

## Sync

`KnowledgeSyncProvider`:

- `local_only` (default) — never leaves the machine
- `self_hosted` — stub, requires endpoint config
- `cloud_future` — not implemented

No automatic sharing.

See [team-brain.md](./team-brain.md).
