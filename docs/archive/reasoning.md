# Reasoning

## Pipeline

```text
User request
  → Context gathering (memories, graph, rules, incidents)
  → Knowledge graph analysis
  → Memory retrieval
  → Rule / conflict evaluation
  → Decision generation
  → Explanation + DecisionTrace
```

## Example recommendation

Recommendation: Use existing PaymentService.  
Reason: 3 existing modules use this pattern.  
Confidence: ~91% (evidence-weighted).
