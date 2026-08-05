# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-05

**Product reset:** Neuron is local-first AI memory for Cursor — not an enterprise platform.

### Works (MVP)

- CLI: `neuron init`, `status`, `scan`, `search`, `doctor`, `cursor setup|doctor|init`, `reset`, `mcp`
- MCP server with **12 tools** only
- `FileStorageProvider` → `.neuron/` (no Docker / Postgres / API keys)
- Versioned brain JSON shareable via Git
- Project scan → brain bootstrap
- Hybrid local search + prepare / save / review / after-task loop
- Cursor rules, skills, and MVP command prompts

### Explicitly not in 0.1

- 100+ experimental MCP tools
- Enterprise workspace / team cloud sync / CRDT
- Required Postgres, Docker, or OpenAI keys
- Architecture review / evaluation / assistant-mode catalogs (see `future/`)

### Changed

- Monorepo cut to ~16 active packages (+ apps); non-MVP moved to `future/`
- `.gitignore` versions brain JSON; ignores cache/runtime/indexes/logs
- README rewritten for the product promise: *Cursor understands your project*
