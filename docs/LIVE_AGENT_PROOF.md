# Live agent proof (Wave D)

Scripted exploration reduction is measured in [REAL_AGENT_BENCHMARK.md](./REAL_AGENT_BENCHMARK.md).

**Live Cursor / API agent A/B** still needs credentials in the environment:

```text
CURSOR_API_KEY / ANTHROPIC_API_KEY
```

When keys are present, run the live harness (if configured in `scripts/`) and record:

1. Whether agents call `neuron_context` **without** being told
2. Whether they honor `present.clarify` / `present.gate`
3. Exploration ops with vs without Brain

Until then: `LIVE_AGENT_PROOF = UNAVAILABLE` remains honest in [DAILY_USE_PRODUCT.md](./DAILY_USE_PRODUCT.md).

Manual smoke (no keys):

```bash
neuron prime
neuron cursor doctor
# In Cursor: "Add auth" on a thin throwaway project — expect AskQuestion from neuron_context
```
