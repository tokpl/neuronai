# `.neuron/` folder

```text
.neuron/
  prefs.json              # init answers / privacy
  brain/
    dna.json
    knowledge.json        # memory, decisions, rules, graph, insights, context
    health.json
    goals.json
    active.json
  evolution/
  runtime/                # engine store (ephemeral)
  cache/
  logs/
```

## Version in Git

By default Neuron can keep `brain/` + `prefs.json` shareable for a team, or treat the whole folder as local-only — you choose at `neuron init`.

Treat `.neuron/` like project notes: no secrets, no raw chat logs.

## Do not commit (ephemeral)

```gitignore
.neuron/cache/
.neuron/runtime/
.neuron/indexes/
.neuron/logs/
```

`neuron init` can also ignore the entire `.neuron/` + `neuron.config.json` (local-only).

## Migration

Flat legacy files (`brain.json`, `decisions.json`, …) migrate into `brain/` on first open.
