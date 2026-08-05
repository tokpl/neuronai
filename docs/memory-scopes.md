# Memory Scopes

| Scope | Visibility | Typical use |
|-------|------------|-------------|
| **PERSONAL** | Owner only | Scratch notes, private hypotheses |
| **PROJECT** | Repo team | Official decisions, patterns, warnings |
| **TEAM** | Cross-project team | Shared playbooks across repos |
| **ORGANIZATION** | Company (future) | Reserved — local stub only |

## Permissions

Actions: `read` · `write` · `approve` · `archive`

| Role | PROJECT write | PROJECT approve | PERSONAL |
|------|---------------|-----------------|----------|
| owner | ✓ | ✓ | own only |
| reviewer | ✓ | ✓ | own only |
| contributor | ✓ | ✗ | own only |
| viewer | ✗ | ✗ | own only |

Shared scopes (`PROJECT` / `TEAM` / `ORGANIZATION`) require **review approval** before a decision is official.

## Graph relations

- `CREATED_BY` — developer authored the memory
- `APPROVED_BY` — reviewer made it official
- `USED_BY` — developer consumed it (e.g. onboarding)
- `MEMBER_OF` / `OWNS` — developer↔team↔project
