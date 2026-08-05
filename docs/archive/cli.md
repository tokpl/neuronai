# CLI reference

Neuron CLI (`apps/cli`, package `@neuron-ai-memory/cli`, bin `neuron`) is the end-user surface for local onboarding and day-to-day memory ops.

**Local-first developer tool** — no mandatory login, telemetry OFF by default, no ads.

## Install

### From this monorepo

```bash
pnpm install
pnpm build
pnpm neuron --help
```

### Global (planned npm package `neuron-ai-memory`)

```bash
npm install -g neuron-ai-memory
neuron --version
```

## Core commands

| Command | Purpose |
|---------|---------|
| `neuron init` | First-run: detect project, create brain, wire Cursor |
| `neuron scan` | Analyze / refresh Project Brain |
| `neuron status` | Brain + store + MCP status |
| `neuron explain` | Plain-language project explanation |
| `neuron doctor` | Diagnose Node, storage, permissions, Cursor, MCP |
| `neuron update` | Schema/brain migrations + incremental knowledge refresh |
| `neuron reset` | Delete local `.neuron/` memory (`--force`) |
| `neuron cursor setup` | Rules + MCP + connection check |

## First run

```bash
neuron init
neuron init --force
neuron init --skip-analyze
```

See [first-run.md](./first-run.md).

### `neuron scan`

```bash
neuron scan
neuron scan --deep
neuron scan --update
neuron scan --architecture
```

### `neuron status`

Shows project identity, memory count, last sync, store mode, MCP config.

### `neuron explain`

Prints stack, privacy mode, and architecture summary from `.neuron/architecture.md`.

### `neuron doctor`

Checks:

- Node version (≥ 22)
- Dependencies / env
- Storage
- Permissions
- Config (`ConfigValidator`)
- Privacy (local-only, telemetry OFF)
- Cursor integration + MCP
- Memory integrity

### `neuron update`

```bash
neuron update              # migrate + scan --update
neuron update --schema-only
```

Handles CLI metadata, config schema migrations, and brain version bumps. Does not phone home.

### `neuron reset`

```bash
neuron reset --force
```

Destructive alias of `neuron purge --force` — removes `.neuron/` only.

### `neuron cursor setup`

```bash
neuron cursor setup
neuron cursor setup --force
```

Writes `.cursor/mcp.json`, rules, skills, commands; validates MCP entry.

### `neuron analyze` / `search` / `suggest` / `export`

Day-to-day knowledge ops (see `--help`).

### `neuron mcp`

Starts the MCP server over stdio (`NEURON_CWD` supported).

## Configuration

`.neuron/config.json` (validated by `ConfigValidator`):

```json
{
  "schemaVersion": 1,
  "privacy": {
    "mode": "suggest",
    "localOnly": true,
    "telemetry": false
  },
  "scan": {
    "depth": "fast",
    "ignore": ["node_modules", ".git", "dist"]
  },
  "providers": {
    "local": { "enabled": true }
  },
  "server": { "mode": "local" }
}
```

## Error experience

Failures are actionable:

```text
Neuron cannot analyze this project because:

Reason:
  Missing TypeScript parser.

Solution:
  Install package.
→ pnpm add -D typescript
```

## Telemetry

Default **OFF**. Never collects source code. Optional anonymous metrics may appear later behind explicit consent.

## Related

- [getting-started.md](./getting-started.md)
- [first-run.md](./first-run.md)
- [cursor-setup.md](./cursor-setup.md)
