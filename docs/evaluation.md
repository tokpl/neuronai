# Evaluation

## Modes

| Mode | Context |
|------|---------|
| `WITHOUT_NEURON` | Raw code / dump only |
| `WITH_NEURON` | Memories · decisions · graph · optimized assembly |

## Metrics

- **Context Precision** — were delivered facts needed?
- **Context Recall** — were important facts found?
- **Token Efficiency** — tokens vs recall
- **Task Success Rate** — simulated success given context
- **Architecture Compliance** — matches project constraints
- **Regression Rate** — risk of breaking existing rules

## Memory quality

Gold labels distinguish durable decisions (“payments use event sourcing”) from noise (“changed variable name x”).

## Continuous evaluation

`EvaluationHistory` records snapshots so you can see whether retrieval latency and memory-gate accuracy improve over runs.
