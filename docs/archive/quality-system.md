# Quality system

Neuron improves through **measurement + feedback + configuration** — never by training models or collecting private chats.

## Feedback labels

- Helpful
- Wrong
- Missing context
- Needs improvement

Technical notes only (redacted). No emotions / PII.

## Hallucinations

`HallucinationDetector` flags:

- unsupported claims (e.g. Redis when graph has none)
- missing evidence
- invented files
- unknown decisions

## Improvement workflow

```text
evaluate_answer / benchmark
        ↓
evaluation.json metrics
        ↓
ImprovementAnalyzer suggestions
        ↓
adjust retrieval weights / approve memories / add .neuron/benchmarks/
```

## Privacy

Persisted: scores, criteria, anonymous technical evidence  
Never: full prompts, secrets, conversation transcripts

See [evaluation-engine.md](./evaluation-engine.md).
