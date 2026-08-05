# Getting started (5 minutes)

Local-first Neuron: detect a project, seed engineering knowledge, connect Cursor.

**No cloud account. No mandatory login. Telemetry OFF by default.**

## 1. Install

```bash
# Monorepo / contributors
pnpm install && pnpm build

# Or (when published)
npm install -g neuron-ai-memory
```

## 2. First run

```bash
cd my-project
neuron init
```

You should see a guided flow:

1. Welcome + privacy banner (local-first)
2. Environment check (Node 22+)
3. Project + technology detection
4. Initial scan + brain creation
5. Cursor MCP / rules
6. **Neuron Report** summary

Then: *AI just learned your project.*

Details: [first-run.md](./first-run.md)

## 3. Verify

```bash
neuron status
neuron doctor
neuron explain
```

## 4. Use in Cursor

1. Open the project in Cursor
2. Enable the **neuron** MCP server
3. Ask:

> Analyze this project using Neuron

or

> Remember this architecture decision: we keep permissions in a dedicated service

```bash
neuron cursor setup
neuron cursor doctor
```

## 5. Day-to-day

```bash
neuron scan
neuron update
neuron search "authentication"
neuron explain
neuron export
```

## What gets stored

Only engineering knowledge worth remembering (stack, architecture notes, decisions, patterns, mistakes) — not chat logs, and never uploaded by default.

See [cli.md](./cli.md), [cursor-setup.md](./cursor-setup.md), and [mcp-tools-reference.md](./mcp-tools-reference.md).
