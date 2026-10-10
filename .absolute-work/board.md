---
id: aw-2026-10-11-antigravity
title: "Antigravity + Neuron adaptation"
type: feature
status: completed
created: "2026-10-11T00:00:00.000Z"
updated: "2026-10-11T00:10:00.000Z"
git_tracked: true
evaluator_enabled: true
total_tasks: 11
completed_tasks: 11
failed_tasks: 0
current_wave: 5
total_waves: 5
---

## Intake Summary

- **Task**: Fix Antigravity Neuron loop + Cursor-level parity
- **Type**: feature
- **Complexity**: medium
- **Spec**: docs/plans/2026-10-11-antigravity-neuron-adapt-design.md
- **Board Persistence**: git-tracked

## Project Conventions

- pnpm + Turborepo TypeScript monorepo
- Verification: `pnpm lint`, `pnpm typecheck`, package vitest

## Rollback Point

Pre-execute working tree (user had `updates/ledger.json` dirty). No auto-commit.

## Verification

- `pnpm lint` — pass
- `pnpm typecheck` — pass
- `@neuronai/cursor-integration` tests — 15 pass
- `neuronai` CLI tests — 25 pass (incl. antigravity setup)

## Task Graph (final)

| ID | Title | Status |
|----|-------|--------|
| AW-001 | Antigravity templates | done |
| AW-002 | installAntigravityIntegration rewrite | done |
| AW-003 | Antigravity doctor | done |
| AW-004 | CLI setup/doctor | done |
| AW-005 | Init deep scan + privacy + hints | done |
| AW-006 | README / prefs hints | done |
| AW-007 | Installer + doctor + CLI tests | done |
| AW-008 | Self code review | done |
| AW-009 | Requirements validation | done |
| AW-010 | Full project verification | done |
| AW-011 | Close board | done |

## Deferred Work

- Auto-write Antigravity OS permission policy files
- Cursor template rewrite beyond shared helpers

## How to test

```bash
neuron antigravity setup --force
neuron antigravity doctor
# Antigravity: Customizations → MCP Servers → Refresh
# Allow mcp(neuron/*)
# Ask agent a coding task → expect neuron_context + 🌱 footer
```

## Suggest commit

```
fix(antigravity): wire Project Brain loop for Antigravity IDE

Use always_on rules, NEURON_CWD workspace MCP, AGENTS.md block,
deep init scan, and neuron antigravity setup/doctor.
```
