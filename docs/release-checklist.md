# Release checklist (v0.1.0 MVP)

## Product honesty

- [x] README leads with local-first Cursor memory
- [x] Experimental packages under `future/` — not advertised as ready
- [x] Positioning: understands *your project* — not “AI that does everything”
- [x] MCP surface = 12 tools

## Quality

- [ ] `pnpm install && pnpm build && pnpm test && pnpm lint` on clean checkout
- [ ] CLI smoke: `neuron init`, `neuron scan`, `neuron status`, `neuron cursor doctor`
- [ ] MCP: Cursor loads server **neuron** and `neuron_health` succeeds
- [ ] Demo: `examples/neuron-demo` first-task path

## Documentation

- [x] Getting started &lt; 10 minutes, no Docker/Postgres/API keys
- [x] Privacy: local-only, telemetry OFF
- [x] MCP docs list only MVP tools
- [x] CHANGELOG honest about scope
- [x] FAQ covers privacy / offline / vs ChatGPT memory
- [x] SECURITY / CONTRIBUTING / CODE_OF_CONDUCT present

## Installation

- [ ] Clean-machine: `npm install -g neuron` (or monorepo `pnpm neuron`) works
- [x] `.env.example` has no required secrets

## Security

- [x] Telemetry off by default
- [ ] `pnpm audit` reviewed
- [x] No hardcoded API keys

## GitHub

- [ ] Issue forms visible
- [ ] Labels created
- [ ] Tag `v0.1.0` when ready
- [ ] Announce with honest MVP scope

## Sign-off

- [ ] Maintainer: init → scan → first Cursor answer
- [ ] Ready to show people (placeholders OK for final artwork)
