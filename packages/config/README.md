# @neuronai/config

Reads the optional `neuron.config.json` at the project root. Internal to NeuronAI — not published.

Neuron works with no config file at all; this only exists so a project can pin a name, stack
or importance threshold in version control.

```json
{
  "project": { "name": "my-project", "type": "application", "stack": ["typescript"] },
  "memory": { "autoSave": true, "importanceThreshold": 0.45 }
}
```

Unknown keys are ignored, so configs written by older versions still load. There is no provider
registry, server mode or database setting — Neuron runs locally over stdio and has nothing to
configure in those directions.
