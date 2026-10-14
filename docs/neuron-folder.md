# The `.neuron/` folder

```text
.neuron/
├── prefs.json            # init answers, privacy mode, workflow prefs (commit)
├── PROJECT_MAP.md        # living map from neuron init / prime        (commit)
├── memory/*.md           # per-memory markdown mirrors (reviewable)   (commit)
├── workflow/
│   ├── board.json        # deliver board (MCP neuron_workflow)        (commit)
│   └── board.md          # human-readable board                       (commit)
├── brain/
│   ├── dna.json          # stack, modules, structure         (commit)
│   ├── knowledge.json    # memories, decisions, rules, graph, map, code (commit)
│   └── health.json       # derived health score              (commit)
├── runtime/
│   └── store.json        # engine store — regenerable        (ignore)
└── cache/                # scan cache                        (ignore)
```

`PROJECT_MAP.md` and `workflow/` appear when you use the [Workflow suite](./workflow.md).

Everything under `brain/` plus `prefs.json` is the durable source of truth. Everything under
`runtime/` and `cache/` can be deleted at any time and rebuilt with `neuron scan`.

## Sharing with a team

Commit `.neuron/brain/` and `prefs.json`. Your teammates get the same architecture decisions,
constraints and warnings the moment they pull.

`neuron init` offers presets for this and writes the matching `.gitignore` block:

| Preset | Committed |
| --- | --- |
| `ephemeral` (default) | `brain/` + `prefs.json` — team shares the brain |
| `ephemeral+config` | same, plus `neuron.config.json` |
| `all-local` | nothing — `.neuron/` stays on your machine |
| `skip` | leaves your `.gitignore` untouched |

Treat `.neuron/` like project notes: no secrets, no credentials, no raw chat logs.

## Migration

Older layouts migrate automatically the first time the brain is opened. Flat files
(`brain.json`, `decisions.json`, `knowledge.json`, `rules.json`, `graph.json`) are folded into
`brain/` and then removed, and the migration is reported rather than done silently.

The `goals.json` and `active.json` planes were removed — they were written on every save but
never populated or read. They are deleted on open if present.
