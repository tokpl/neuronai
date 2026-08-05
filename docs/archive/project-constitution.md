# Project Constitution

Neuron’s **Project Constitution** is the living set of rules for *how this project should be developed*.

It is not chat memory. It is an approved, versioned policy layer on top of memories and patterns.

## Example

```markdown
# Project Constitution

## Architecture
- Use service layer for business logic
- No direct database access from controllers

## Frontend / Coding style
- Components must be reusable
- State belongs to feature modules

## Database
- All migrations require review

## Security
- Never bypass permission checks **[CRITICAL]**
```

Stored as:

- `.neuron/constitution.json` — machine-readable
- `.neuron/constitution.md` — human-readable export
- `.cursor/rules/project-architecture.mdc` — generated for Cursor (after approval)

## Rule model

| Field | Notes |
|-------|--------|
| category | ARCHITECTURE, CODING_STYLE, SECURITY, DATABASE, TESTING, DEPLOYMENT |
| severity | INFO, WARNING, CRITICAL |
| source | manual, generated, learned |
| status | suggested → approved → active (or rejected) |
| confidence | 0–1 |

## Approval (required)

```text
Generated suggestion
        ↓
   User review
        ↓
  Approved rule
        ↓
 Active constitution
```

**CRITICAL** rules cannot be auto-activated from generated/learned sources. Promoting CRITICAL sets `source=manual` after explicit human confirmation (`--critical` / `asCritical`).

## CLI

```bash
neuron constitution
neuron constitution suggest
neuron constitution accept <ruleId>
neuron constitution accept <ruleId> --critical
neuron constitution health
neuron constitution evolution --commits 50
neuron constitution cursor-rules
```

## MCP

- `neuron_project_rules`
- `neuron_suggest_rule`
- `neuron_accept_constitution_rule`
- `neuron_project_health`
- `neuron_review_evolution`
- `neuron_generate_cursor_rules`

See also [self-learning.md](./self-learning.md) and [rule-generation.md](./rule-generation.md).
