# Root cause analysis

`RootCauseAnalyzer` ranks hypotheses with confidence, using:

- error / stack text
- changed files
- git-adjacent signals (via caller)
- prior incidents
- architecture decisions

Example output:

1. Database migration mismatch — **82%**  
2. Validation regression — **41%**

Always advisory. Automatic detection of repeated errors/failed tests yields **candidates** with `requiresConfirmation: true`.
