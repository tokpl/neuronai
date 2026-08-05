# Neuron AI Memory CLI

Developer experience for local Neuron: first-run onboarding, scan, explain, doctor, Cursor setup, and MCP launch.

**Local-first** — telemetry OFF by default, no cloud account, no ads.

> Package location: `apps/cli` (bin `neuron`, workspace `@neuron-ai-memory/cli`).

## Install (from monorepo)

```bash
pnpm install
pnpm build
pnpm neuron --help
```

## First run

```bash
cd my-project
neuron init
```

Guided flow: welcome → privacy → detect → scan → brain → Cursor → **Neuron Report**.

See [docs/first-run.md](../../docs/first-run.md).

## Commands

| Command | Description |
|---------|-------------|
| `neuron init` | First-run: local AI brain + Cursor wiring |
| `neuron scan` | Bootstrap / refresh Project Brain |
| `neuron status` | Project / store / MCP / memory counts |
| `neuron explain` | Plain-language brain explanation |
| `neuron doctor` | Node, storage, permissions, Cursor, MCP |
| `neuron update` | Schema + brain migrations (+ knowledge refresh) |
| `neuron reset` | Delete local `.neuron/` (`--force`) |
| `neuron cursor setup` | Rules + MCP + connection check |
| `neuron analyze` | Re-run project analysis |
| `neuron search <q>` | Hybrid search over local memories |
| `neuron export` | Markdown export under `.neuron/export/` |
| `neuron mcp` | Start MCP server (stdio) |

## Layout

```text
src/
  commands/      # init, scan, status, explain, doctor, update, reset, cursor-*
  ui/            # terminal colors / failHelp
  progress/      # ProgressUI
  config/        # .neuron/config.json + ConfigValidator
  diagnostics/   # doctor checks, updater, NeuronCliError
  templates/     # first-run copy + Neuron Report
  services/      # fs, session, cursor
```

## Architecture

CLI → services → memory-engine / project-scanner / cursor-integration. Command handlers orchestrate UX only.
