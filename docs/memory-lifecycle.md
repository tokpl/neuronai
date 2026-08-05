# Memory lifecycle

Governance lifecycle (orthogonal to store `active|archived|superseded`):

```text
PROPOSED → ACTIVE → VALIDATED
                ↘ OUTDATED → ARCHIVED
                ↘ CONFLICTED → (resolve) → VALIDATED / ARCHIVED
```

| State | Meaning |
|-------|---------|
| PROPOSED | New / unconfirmed |
| ACTIVE | Current truth in use |
| VALIDATED | Confirmed by code/tests/git/developer |
| OUTDATED | Stale vs code or age — still kept |
| CONFLICTED | Competing facts — needs resolution |
| ARCHIVED | History only — **never deleted** |

Package: `@neuron-ai-memory/memory-governance`

## Decay

`MemoryDecayEngine` adjusts confidence / importance / priority from age, usage, validation, and project changes. It does **not** remove memories.

## Importance

`MemoryImportanceCalculator` — frequency, connections, business impact, recent usage, developer validation.

Example: database ADR → ~98%; temporary note → ~12%.

See [memory-quality.md](./memory-quality.md) and [conflict-resolution.md](./conflict-resolution.md).
