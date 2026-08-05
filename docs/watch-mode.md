# Watch mode

```bash
neuron watch
```

Runs **locally only**:

- filesystem watcher (debounced)
- optional git HEAD poll
- skips `.env`, credentials, `node_modules`, `.git`, `dist`

Low-importance noise (README typos, CSS) is classified `LOW` and skipped.

Stop with `Ctrl+C`. State can be persisted under `.neuron/continuous-intelligence.json` when the session ends.
