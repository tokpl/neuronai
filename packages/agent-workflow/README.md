# @neuronai/agent-workflow

Ask-before-remember. Internal to NeuronAI — not published.

After a coding task, analyses what changed, decides whether anything is worth keeping, and
produces a draft plus the question to put to the user. Nothing is written until they answer.

```text
diff / summary ──▶ change analysis ──▶ suggestion ──▶ quality gate ──▶ draft + question
```

The quality gate uses the same duplicate detection as storage (`@neuronai/brain`), so the
workflow never proposes knowledge the project already has.

Never stores chat transcripts. Only high-signal engineering knowledge.
