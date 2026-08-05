# Cursor troubleshooting

## MCP server missing / red

1. `neuron cursor setup --force`
2. Confirm `neuron` is on `PATH` (`neuron --version`)
3. Reload Cursor window
4. `neuron cursor doctor`

Monorepo without global bin:

```json
"command": "pnpm",
"args": ["exec", "neuron", "mcp"],
"env": { "NEURON_CWD": "C:/path/to/project" }
```

## Rules / skill not applied

- Ensure `.cursor/rules/neuron-memory.mdc` has `alwaysApply: true`
- Re-run `neuron cursor setup --force`
- Start a **new** agent chat after changing rules

## Agent ignores Neuron

- Explicitly ask: “Use Neuron MCP tools”
- Try `/neuron-context` command prompt
- Check `neuron_health` tool responds

## Project brain files empty

```bash
neuron analyze
neuron init cursor
```

## Permissions

Local mode needs no API key. Cloud mode requires `NEURON_API_KEY` (future).

## Still stuck

Run `neuron doctor` and `neuron cursor doctor`, paste redacted output into an issue.
