# Onboarding

## Flow

```text
New developer: "How does this project work?"
        │
        ▼
  OnboardingEngine
        │
        ├── Architecture overview
        ├── Important decisions (approved)
        ├── Common mistakes
        └── Coding rules / patterns
```

## MCP

- `neuron_onboarding` — generate the pack
- `neuron_team_context` — query shared knowledge
- `neuron_decision_history` — timeline of decisions
- `neuron_contributors` — who created / approved knowledge

## CLI / Cursor tip

After `neuron init`, a teammate can ask Cursor:

> How does this project work? Use Neuron onboarding.

Neuron answers from **active PROJECT/TEAM** memories — not from PERSONAL notes of other developers.
