# Context optimization

## Problem

Agents fail less from *missing* facts than from *too many* facts.

## Budgets

| Complexity | Tokens | Typical use |
|------------|--------|-------------|
| small | 1 500 | typo / small fix |
| standard | 5 000 | feature |
| large | 8 000 | cross-cutting |
| architecture | 15 000 | architecture review / refactor |

Agent modes:

- `fast` → tighter cap
- `architect` / `refactor` → architecture budget

## Compression techniques

1. Deduplication  
2. Near-duplicate merging  
3. Priority line extraction (Decision / Warning / Must)  
4. Local summarization (first sentence / trim)  
5. Hard token + item caps  

## Cursor mapping

| Change type | Context |
|-------------|---------|
| Small fix | minimal budget |
| New feature | standard / large |
| Refactor | architecture + graph-oriented hits |

## Preview

```bash
neuron optimize-context "Add payment refunds" --explain
```

MCP: `neuron_optimize_context` / `neuron_explain_context`
