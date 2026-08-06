# MCP tools

Neuron registers **7 tools**, one job each. Tool descriptions are context the agent pays for on
every turn, so they are deliberately short.

| Tool | Purpose |
| --- | --- |
| `neuron_context` | Ranked, compressed project knowledge for a coding task |
| `neuron_search` | Keyword search over memories |
| `neuron_remember` | Store a decision, pattern, warning or fact (duplicates merge) |
| `neuron_update` | Change an existing memory — versioned, old content kept |
| `neuron_after_task` | Propose what is worth remembering after coding |
| `neuron_resolve_suggestion` | Apply the user's Yes / Edit / No answer |
| `neuron_scan` | Rebuild the project brain from the codebase |

## `neuron_context`

The main one. Retrieval ranks, the compiler compresses, and the agent gets a single markdown
document — no parallel JSON copy, no ranking metadata, no memory ids.

```json
{ "task": "add rate limiting to the MCP server tool handlers", "mode": "minimal" }
```

| Mode | Budget | Use for |
| --- | --- | --- |
| `minimal` (default) | 500 tokens | everyday coding |
| `standard` | 1200 tokens | multi-file features |
| `deep` | 3500 tokens | architecture and refactors |

The response shape:

```json
{
  "ok": true,
  "context": "…",
  "mode": "minimal",
  "intent": "MODIFICATION",
  "recommendation": {
    "path": "src/billing/service.ts",
    "name": "BillingService",
    "symbol": "BillingService.cancelInvoice()",
    "reason": "Owns invoice lifecycle; verified callers in billing routes",
    "related": [{ "path": "src/billing/routes.ts", "name": "routes.ts" }],
    "flow": [{ "label": "POST /invoices/:id/cancel" }, { "label": "BillingService.cancelInvoice()" }]
  },
  "relevantFiles": [{ "name": "middleware.ts", "path": "src/auth/middleware.ts", "kind": "file", "why": "…" }],
  "relevantModules": [{ "name": "auth", "path": "src/auth/", "purpose": "Authentication / authorization" }],
  "relevantRules": [{ "title": "…", "detail": "…" }],
  "flow": [{ "label": "POST /invoices/:id/cancel" }, { "label": "BillingService.cancelInvoice()" }],
  "metrics": {
    "contextTokens": 126,
    "budgetTokens": 500,
    "corpusTokens": 1800,
    "itemsSelected": 5,
    "itemsDiscarded": 12,
    "estimatedTokensSaved": 1180,
    "compressionRatio": 14.3,
    "baseline": "whole-brain-verbatim",
    "retrievalMs": 4,
    "estimatedRediscoveryAvoided": 240,
    "rediscoveryBaseline": "simulated-structural-exploration"
  }
}
```

`estimatedTokensSaved` is vs pasting the whole brain. `estimatedRediscoveryAvoided` is a **simulated**
estimate of structural exploration the agent might otherwise do — not measured agent file-read
savings.

`context` is the only field that should enter the model prompt. Call this **before** exploring the
repository; open the returned paths next. Ranking scores and memory ids never appear in `context`.

`estimatedTokensSaved` is honest: whole-brain verbatim size minus the compiled context
(`baseline: "whole-brain-verbatim"`). It is not a measurement of tokens the agent would have
spent reading source files.

If nothing in the brain matches the task, the context says so rather than returning
high-importance memories about unrelated topics.

CLI equivalent for debugging:

```bash
neuron context "Where are API routes?"
```

## Ask before remembering

1. Agent calls `neuron_after_task` with a summary or diff
2. If there is something worth keeping, the response carries a `draft` and a `question`
3. Agent asks the user with Cursor `AskQuestion` (**Yes** / **Edit** / **No**), or in plain words
4. Agent calls `neuron_resolve_suggestion` with `action: "save" | "edit" | "ignore"`

Nothing is written to memory before step 4.

## Resources

- `neuron://project/brain` — stack, decisions, rules, modules and health

## Prompts

- `neuron_before_coding`
- `neuron_after_coding`
