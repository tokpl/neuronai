# Modes reference

## Architect

- Capabilities: architecture_review, knowledge_graph, decision_engine
- Context: architecture, knowledge_graph, decisions, dependencies
- Tools: `neuron_architecture_review`, `neuron_architecture_scan`, `neuron_reason`, `neuron_graph_query`

## Code review

- Context: git_diff, files, architecture, security_rules
- Output: Issues, Risks, Suggestions

## Debug

- Context: logs, incidents, knowledge_graph, files
- Output: Root cause, Evidence, Fix plan

## Security review

- Context: **files**, **dependencies**, **security_rules**
- Tools: `neuron_security_scan`, `neuron_security_check`, `neuron_check_context`

## Performance

- Intent example: “why is this slow?”
- Output: Bottlenecks, Impact, Optimization plan

## Documentation / Onboarding / Refactoring

See `neuron_available_modes` for full JSON descriptors including `priorityRules` and `cursorCommand`.

## Evaluation

`ModeUsageMemory` tracks usefulness, accuracy hints, and developer feedback (local `.neuron/assistant-modes.json`).
