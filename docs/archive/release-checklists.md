# Release checklists

## 1. Production readiness

- [x] Local MCP + CLI install path documented
- [x] Health endpoint / tool with version + `neuron/v1`
- [x] Backup / restore / purge CLI
- [x] Memory maintenance dry-run
- [x] Production DB indexes migration
- [x] Structured logging + correlation id mixin
- [x] Metrics / tracing / error reporter abstractions (noop default)
- [ ] HTTP MCP mode with SIGTERM drain
- [ ] `maintain --apply` archive automation

## 2. Security checklist

- [x] Local-first default (no telemetry)
- [x] Secret redaction helper
- [x] `.env.example` without live secrets
- [x] Cloud API key auth path
- [x] ACL role architecture stubs
- [x] SECURITY.md reporting process
- [ ] Dependency scanning in CI (workflow added; enable on GitHub)
- [ ] Penetration review of MCP tool auth for cloud mode

## 3. Open source release checklist

- [x] Apache-2.0 LICENSE
- [x] CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / SUPPORT
- [x] CHANGELOG.md
- [x] Issue + PR templates
- [x] CI workflow
- [x] Release + security-scan workflows (prepared)
- [x] Public README + docs set
- [x] Examples folder
- [ ] npm publish of `0.1.0` (manual / release workflow)
- [ ] GitHub Security Advisories enabled on repo

## 4. Missing before v1.0

- Apply-mode maintenance & compaction jobs
- First-class Postgres path as default for “production self-host”
- Stable published packages on npm under agreed names
- Broader E2E with Cursor recorded as release note
- Contributor “good first issues” labeled on tracker

## 5. Proposed v1.0 roadmap

1. **0.1.x** — OSS local beta (this hardening pass)  
2. **0.2** — Postgres-default self-host guide + Docker polish  
3. **0.3** — MCP `neuron/v1` freeze candidate + SDK polish  
4. **1.0** — Semver stability guarantee, security audit summary, install <5 minutes verified
