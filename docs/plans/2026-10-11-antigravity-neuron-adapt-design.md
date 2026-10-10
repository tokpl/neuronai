# Antigravity + Neuron Adaptation Design Spec

## Summary

Make Neuron’s Antigravity IDE integration actually drive the Project Brain loop: agents call `neuron_context` / `neuron_after_task`, append the contribution footer, and get a deep brain on init—without users manually running `neuron scan --deep`. Fix silent rule discard (wrong frontmatter), wrong MCP env (`NEURON_PROJECT_ROOT` vs `NEURON_CWD`), and bring Cursor-level setup/doctor parity.

## Context

Antigravity loads workspace rules from `.agents/rules/*.md` only when YAML frontmatter includes a valid `trigger` (`always_on`, `model_decision`, `glob`, `manual`). Missing or Cursor-style `alwaysApply` causes **silent discard**. Skills live under `.agents/skills/<name>/SKILL.md`. MCP config is global (`~/.gemini/config/mcp_config.json`) and/or workspace (`.agents/mcp_config.json`); MCP tools default to Ask unless Allow `mcp(server/*)`.

Today [`packages/cursor-integration/src/antigravity.ts`](../../packages/cursor-integration/src/antigravity.ts) copies Cursor templates verbatim, sets `NEURON_PROJECT_ROOT` (ignored by [`apps/mcp-server/src/index.ts`](../../apps/mcp-server/src/index.ts)), and only writes global MCP. Init always scans `fast`.

## Design

### Architecture

```
neuron init / neuron antigravity setup
  → installAntigravityIntegration(projectRoot)
      → .agents/mcp_config.json (NEURON_CWD)
      → ~/.gemini/config/mcp_config.json (add/fix env; no path clobber if workspace exists)
      → .agents/rules/neuron-memory.md (trigger: always_on)
      → .agents/skills/neuron-memory/SKILL.md
      → AGENTS.md marked block upsert
  → session.scan('deep') when integrations.antigravity
  → privacy.mode = automatic when ide === antigravity only
```

### Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| Antigravity installer | `packages/cursor-integration/src/antigravity.ts` | MCP, rules, skill, AGENTS.md |
| Antigravity templates | `packages/cursor-integration/templates/antigravity/**` | Native frontmatter + wording |
| Antigravity doctor | `packages/cursor-integration/src/antigravity-doctor.ts` | Checks + optional stdio probe |
| Package exports | `packages/cursor-integration/src/index.ts` | Public API |
| CLI setup/doctor | `apps/cli/src/commands/antigravity-*.ts`, `index.ts` | `neuron antigravity setup\|doctor` |
| Init | `apps/cli/src/commands/init.ts`, `init-preferences.ts` | Deep scan, privacy, paths, hints |
| Docs | `README.md` | Correct `.agents/` paths + permissions |

### Interfaces / API Surface

```ts
export interface AntigravityInstallResult {
  workspaceMcpPath: string;
  globalMcpPath: string;
  rulesPath: string;
  skillPath: string;
  agentsMdPath: string;
  mcpConfigured: boolean;
  mcpErrors: string[];
  mcpWarnings: string[];
}

export async function installAntigravityIntegration(
  projectRoot: string,
  options?: { force?: boolean },
): Promise<AntigravityInstallResult>;

export async function runAntigravityDoctorChecks(
  projectRoot: string,
): Promise<AntigravityDoctorReport>;
```

CLI:

- `neuron antigravity setup [--force]`
- `neuron antigravity doctor`

### Data Flow

1. Installer merges workspace MCP via `buildNeuronMcpEntry` / `mergeNeuronMcpConfig`.
2. Global MCP: add `neuron` if missing; migrate `NEURON_PROJECT_ROOT` → `NEURON_CWD`; leave existing `NEURON_CWD` path when workspace config is written.
3. Agent loads always-on rule + skill → calls `neuron_context` → appends `contribution.summary` → `neuron_after_task` (autosave when automatic).

## Error Handling

| Failure | Behavior |
|---------|----------|
| Global MCP unreadable | Recreate `{ mcpServers: { neuron } }` (preserve best-effort parse) |
| Workspace MCP invalid after write | `mcpConfigured: false`, errors in result; CLI exits non-zero |
| AGENTS.md missing markers | Upsert full marked block |
| Doctor stdio probe fail | Check fails with fix `neuron antigravity setup --force` |

## Testing Strategy

- Unit: installer writes `trigger: always_on`, `NEURON_CWD`, workspace+global merge, AGENTS.md markers, stale refresh without `--force`.
- Doctor: fails when frontmatter wrong / MCP missing; passes after install + brain files.
- Init prefs hint path string; scan depth `'deep'` when antigravity integration enabled (assert via local config / injectable path if present).

## Migration Path

1. Users re-run `neuron antigravity setup --force` or `neuron init --force`.
2. Refresh MCP in Antigravity UI; Allow `mcp(neuron/*)`.
3. No brain schema migration.

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | A+B | Unblock + Cursor parity |
| MCP | Workspace + global fallback | Multi-project safe |
| Init scan | Deep when Antigravity enabled | Removes manual `--deep` |
| Guidance | Rule + skill + AGENTS.md | Max always-on visibility |
| AGENTS.md | Marked-block upsert | Safe re-runs |
| Privacy | automatic only for pure Antigravity; both→suggest | Shared Cursor UX |
| Permissions | Docs/hints only | Do not rewrite OS policy |

## Spec review (self-score, generator)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Completeness | 5 | Paths, CLI, init, docs, tests covered |
| Consistency | 5 | Matches intake locks |
| Clarity | 4 | Clear ownership table |
| Scope | 5 | Deferred items listed |
| Testability | 4 | Concrete installer/doctor cases |

**Average: 4.6** — proceed to decompose/execute.
