# Assistant modes

`@neuron-ai-memory/assistant-modes` — specialized developer workflows.

Each `NeuronMode` has: id, name, description, capabilities, priority rules, output format, required context.

## Built-in modes

| Mode | Focus |
|------|--------|
| `architect` | Boundaries, patterns, tradeoffs |
| `code_review` | Issues, risks, suggestions |
| `debug` | Root cause, evidence, fix plan |
| `security_review` | Threats, severity, recommendations |
| `performance` | Bottlenecks, impact, optimization |
| `documentation` | Technical / architecture docs |
| `onboarding` | Learning path, concepts, mistakes |
| `refactoring` | Before/after, risks, migration plan |

## MCP

- `neuron_available_modes`
- `neuron_mode_context`
- `neuron_run_mode`

`ModeRouter` maps intent (e.g. “why is this slow?” → performance).

Standard output: Summary · Evidence · Findings · Recommendations · Confidence.

No autonomous agents, no multi-agent orchestration, no automatic code edits.
