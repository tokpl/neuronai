# Release checklist (v0.1.0 MVP)

Use before tagging `v0.1.0` / cutting the first public GitHub release.

Scope: [mvp.md](./mvp.md) · Full review: [product-architecture-review.md](./product-architecture-review.md)

## Product honesty

- [ ] README leads with **Local Project Brain** (P0), not the full experimental catalog
- [ ] Experimental packages labeled (workspace, evaluation, team brain, …)
- [ ] Positioning clear: understands *your project* — not “AI that does everything”

## Quality

- [ ] `pnpm install && pnpm build && pnpm test && pnpm lint` pass on a clean checkout
- [ ] CLI smoke: `neuron init`, `neuron scan`, `neuron status`, `neuron cursor doctor` on a temp project
- [ ] MCP: Cursor loads server **neuron** and `neuron_health` succeeds
- [ ] **Performance:** scan + retrieval on mid-size repo; note expected times in docs
- [ ] Demo: open `examples/neuron-demo`, run prepare_task prompt from [docs/demo/03-first-task.md](./demo/03-first-task.md)

## Documentation

- [ ] [getting-started.md](./getting-started.md) / first-run works as written (&lt;10 min)
- [ ] Privacy model documented (local-only, telemetry OFF)
- [ ] MCP tools: P0 tools called out; experimental tools listed separately
- [ ] CHANGELOG lists works / experimental / later
- [ ] [docs/demo/](./demo/) scripts reviewed (no stale commands)
- [ ] FAQ answers privacy / offline / MCP / vs ChatGPT memory
- [ ] SECURITY / CONTRIBUTING / CODE_OF_CONDUCT / DEVELOPMENT present

## Installation & examples

- [ ] Clean-machine install verified (Windows + macOS if possible)
- [ ] `examples/neuron-demo` runs the “first useful answer” path
- [ ] `.env.example` has no secrets

## Security review

- [ ] Local-first defaults confirmed (telemetry off)
- [ ] No secret persistence in traces / git ingest summaries
- [ ] SECURITY.md reporting path valid
- [ ] `pnpm audit` reviewed (high+ triaged)
- [ ] No hardcoded API keys in repo

## Packages & ops

- [ ] Workspace packages build (`turbo run build`)
- [ ] Docker: `pnpm docker:up` healthy (optional Postgres — experimental)
- [ ] Backup basics documented

## GitHub

- [ ] Issue forms (`bug.yml`, `feature.yml`) visible
- [ ] Labels created (`bug`, `enhancement`, `good first issue`, `help wanted`)
- [ ] Discussions enabled (optional but recommended)
- [ ] Release notes from CHANGELOG + auto-generated commits
- [ ] Tag `v0.1.0` (publish npm only when tokens ready)

## Sign-off

- [ ] Maintainer: Cursor integration tested manually (init → scan → first answer)
- [ ] Maintainer: security spot-check
- [ ] Ready to announce (Discussions / Discord placeholder)
