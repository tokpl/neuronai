# First run experience

`neuron init` is designed so the first contact feels like: **AI just learned my project.**

## Principles

- **Local-first** — code stays on your machine
- **Telemetry OFF** by default (never collects source code)
- **No cloud account / login**
- **Readable progress** — not a silent black box

## Workflow

```text
Developer:  neuron init

Neuron:
  Welcome to Neuron.
  I will create a local AI brain for this project.

  ✓ Neuron is local-first.
  ✓ Your code stays on your machine.
  ✓ Telemetry: OFF (never collects source code).

  [1/7] Environment check…
  ✓ Node v22.x.x

  [2/7] Project detection…
  ✓ Detected project: My Application

  [3/7] Technology detection…
  ✓ Detected Next.js
  ✓ Found database layer (postgresql)

  [4/7] Initial scan…
  ✓ Created architecture graph
  ✓ Generated initial memories

  [5/7] Brain creation…
  ✓ Project brain files written

  [6/7] Cursor integration…
  ✓ Created Cursor rules + MCP

  [7/7] Ready
  ✓ Local AI brain is ready

  Neuron Report
  …
```

## Config written

`.neuron/config.json` includes:

| Section | Purpose |
|---------|---------|
| `scan` | Depth + ignore globs |
| `privacy` | `localOnly`, `telemetry` (default false), write mode |
| `providers` | Local / optional model providers |
| `integrations` | Cursor / future hosts |
| `server.mode` | `local` (cloud not required) |

## After init

```bash
neuron status
neuron explain
neuron doctor
neuron cursor doctor
```

## Reset

```bash
neuron reset --force   # deletes .neuron/ only — never your source
neuron init            # learn the project again
```

See [cli.md](./cli.md) and [getting-started.md](./getting-started.md).
