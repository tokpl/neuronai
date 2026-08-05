# Cursor workflows (modes)

Neuron modes are **MCP workflows**, not a Cursor plugin marketplace.

## Commands

Installed under `.cursor/commands/` (via `neuron cursor setup`):

| Command | Mode |
|---------|------|
| `/architect` | Architect |
| `/review` | Code review |
| `/debug` | Debug |
| `/security` | Security review |
| `/performance` | Performance |
| `/docs` | Documentation |
| `/refactor` | Refactoring |

Each command tells the agent to call `neuron_run_mode` and follow suggested MCP tools.

## Example

```text
Developer: /performance why is checkout slow?
→ neuron_run_mode(query, modeId optional)
→ ModeRouter → performance
→ suggested: neuron_performance_review, …
→ structured output + confidence
```
