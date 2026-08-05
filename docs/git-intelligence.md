# Git intelligence

Git is an **additional knowledge source** for Neuron — not a GitHub/GitLab replacement.

## Location

- `packages/workflow-intelligence/src/git/` — classification, commits, evolution, regressions, timeline
- `packages/knowledge-graph/src/git/` — evolution → graph link hints

Persist: `.neuron/git-intelligence.json` (summaries only)

## Flow

```text
commit message + file list (+ optional sanitized diff)
  → ChangeClassifier
  → CommitAnalyzer → GitChangeMemory
  → DecisionConnectionLinker
  → ArchitectureEvolutionTracker
  → RegressionDetector
  → EngineeringTimeline / history context
```

## Security

- No full commit patches persisted by default
- Secret-like lines redacted from diff excerpts
- Blame intelligence answers **where knowledge originated**, never who is “guilty”

## MCP

| Tool | Role |
|------|------|
| `neuron_git_context` | Change context (+ optional ingest) |
| `neuron_change_history` | Module history |
| `neuron_architecture_evolution` | System evolution |
| `neuron_regression_check` | Similar-to-past-problem |
| `neuron_history_context` | “Why is this code like this?” |
