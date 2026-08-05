# /review

Code review workflow via Neuron.

1. Call `neuron_run_mode` with `modeId: "code_review"` or query `/review …`
2. Include git diff / changed files in the prompt
3. Use suggested tools for security, performance, and architecture checks
4. Output Issues, Risks, Suggestions

Do not merge or push automatically.
