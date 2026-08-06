# `.neuron/` folder

```text
.neuron/
  config.json
  brain.json
  knowledge.json
  decisions.json
  rules.json
  graph.json
  cache/
  runtime/
  indexes/
  logs/
```

## Version in Git

Commit the JSON files above so teammates get project knowledge on `git pull`.

## Do not commit

Ephemeral paths (usually added by `neuron init` into `.gitignore`):

```gitignore
.neuron/cache/
.neuron/runtime/
.neuron/indexes/
.neuron/logs/
```

`neuron init` asks how to update `.gitignore` (recommended ephemeral-only, also ignore `neuron.config.json`, local-only entire `.neuron/`, or skip).

## Migration

If you have a legacy layout (`.neuron/data/store.json`, markdown brain files), the first `neuron init` / MCP start migrates store → `runtime/store.json` and creates the new JSON files.
