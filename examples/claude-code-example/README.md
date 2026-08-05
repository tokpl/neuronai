# Claude Code example

## Goal

Wire Neuron MCP tools into Claude Code.

## MCP config sketch

Add a server entry that runs the built MCP process:

```json
{
  "mcpServers": {
    "neuron": {
      "command": "node",
      "args": ["C:/path/to/neuron-ai-memory/apps/mcp-server/dist/index.js"],
      "env": {
        "NEURON_CWD": "C:/path/to/your/project",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Adjust paths for your OS. Prefer `pnpm neuron mcp` during development.

## Suggested prompts

- “Call neuron_project_summary then neuron_prepare_task for refactoring auth.”
- “neuron_analyze_impact for packages/storage”
- “neuron_review_architecture for the billing module”

## Privacy

Keep `NEURON_TELEMETRY` unset/off. Memories stay under `.neuron/data` unless you configure Postgres.
