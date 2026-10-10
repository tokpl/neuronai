# Neuron Init Interactive CLI UX Design Spec

## Summary

Replace numbered preference prompts in `neuron init` with a zero-dependency TTY UI: arrow navigation, Space multi-select for IDE targets, Enter to confirm. IDE setup no longer uses Both/None rows; at least one IDE must be selected. Memory and gitignore use the same single-select UX. Other CLI commands keep the existing numbered `askChoice`.

## Context

Today `apps/cli/src/ui/prompt.ts` only supports typed numbers. IDE prefs in `apps/cli/src/commands/init-preferences.ts` use mutually exclusive `cursor | antigravity | both | none`. Init maps that in `apps/cli/src/commands/init.ts` into `localConfig.integrations`. Users expect Space/Enter multi-select instead of a fake “Both” option.

## Design

### Architecture

- New prompt primitives under `apps/cli/src/ui/` using raw stdin when TTY.
- Pure key/state reducers tested without a real terminal.
- `askInitPreferences` is the only consumer of `askMultiSelect` in this wave.
- Non-TTY / `CI=true` / `--yes`: no raw-mode UI; defaults apply.

### Components

| Component | Path | Responsibility |
| --- | --- | --- |
| TTY state + key parse | `apps/cli/src/ui/tty-prompt.ts` | Raw-mode loop, render, restore terminal |
| Select APIs | `apps/cli/src/ui/prompt.ts` | Export `askSelect` / `askMultiSelect`; keep `askChoice` for remember |
| Init prefs | `apps/cli/src/commands/init-preferences.ts` | Multi-select IDE; single-select memory/gitignore |
| Init wire | `apps/cli/src/commands/init.ts` | Map `IdeIntegrationFlags` into integrations |

### Data Model

```typescript
export type IdeIntegrationFlags = {
  cursor: boolean;
  antigravity: boolean;
};
```

`--yes` / non-interactive default: `{ cursor: true, antigravity: false }`.

### Interfaces / API Surface

```typescript
askSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<{ value: T; label: string; hint?: string }>;
  defaultValue: T;
  useDefaults?: boolean;
}): Promise<T>;

askMultiSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<{ value: T; label: string; hint?: string }>;
  /** Values pre-checked when interactive; empty = none checked. */
  initialSelected?: T[];
  /** When true, Enter with zero selected stays on the prompt with a warning. */
  requireOne?: boolean;
  emptyWarning?: string;
  /** Non-interactive / --yes result. */
  defaultSelected: T[];
  useDefaults?: boolean;
}): Promise<T[]>;
```

### Data Flow

1. `runInit` → `askInitPreferences`.
2. IDE: `askMultiSelect` over `cursor` / `antigravity` (start empty; require ≥1).
3. Memory: `askSelect` (suggest / automatic / manual).
4. Gitignore: `askSelect` (ephemeral / … / skip).
5. Init writes `integrations: { cursor, antigravity }` and runs existing setup paths.

### Interaction rules

| Control | Behavior |
| --- | --- |
| ↑ / ↓ | Move highlight |
| Space | Toggle check (multi only) |
| Enter | Confirm; multi with `requireOne` rejects empty |
| Esc / Ctrl+C | Abort init (`NeuronCliError`) |
| Start (multi) | Nothing checked |
| Footer | Dim hints under the list |

## Error Handling

| Case | Behavior |
| --- | --- |
| Esc / Ctrl+C | Restore TTY; throw `NeuronCliError` (cancelled) |
| Empty multi Enter | Inline warning; stay on prompt |
| Non-TTY / `--yes` | Return defaults; no raw mode |

## Testing Strategy

- Unit: key parse + select state reducer (toggle, reject empty, confirm one/both, navigate, abort).
- Existing CLI tests with `--yes` init must still pass.
- `pnpm --filter neuronai test` + typecheck/lint as needed.

## Migration Path

No persisted schema change. Remove interactive `'both' | 'none'` preference union; map booleans only. Callers outside init do not use the old union.

## Decision Log

1. Scope = `neuron init` interactive prefs only (not whole CLI).
2. Custom zero-dep TTY layer (not `@clack`).
3. Multi-select IDE; no Both/None rows; ≥1 required.
4. Interactive start = nothing checked; `--yes` = Cursor only.
5. Esc/Ctrl+C abort whole init.
6. Memory + gitignore also move to arrow single-select.
