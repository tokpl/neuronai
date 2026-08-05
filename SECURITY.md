# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes (best effort) |
| pre-0.1 | No |
|

Pre-1.0: fixes land on the default branch first.

## Reporting a vulnerability

**Do not** open a public issue for security-sensitive reports.

Prefer:

1. GitHub Security Advisories (once the repository is published), or
2. A private report to the maintainers.

Include steps to reproduce, impact assessment, and any suggested fix.

## Threat model (summary)

| Mode | Auth | Data leaving device |
|------|------|---------------------|
| Local (default) | `LOCAL_USER` / trusted host | None (unless you call an AI provider you configured) |
| Cloud-ready (future) | API key + roles (`TEAM_MEMBER`, `ADMIN`, `SERVICE_ACCOUNT`) | Only with explicit consent / hosting contract |

ACL roles are architected in `@neuronai/security`; full SaaS is out of scope for OSS core.

## Secrets

- Never commit `.env` or live keys
- Use `.env.example` as a template
- Log via `redactSecrets` / structured logger - never print API keys or `DATABASE_URL` passwords
- Optional provider keys (`OPENAI_API_KEY`, etc.) stay in the environment

## Privacy & telemetry

- Telemetry and remote error reporting are **opt-in** (`NEURON_TELEMETRY=0` default; in-app consent required)
- See [docs/privacy.md](./docs/privacy.md)

## Product security notes

Neuron may store project knowledge that could include sensitive context. Operators should:

- Prefer **local / self-hosted** deployments for private codebases
- Keep secret redaction enabled when logging
- Treat memory contents as sensitive as source code
- Restrict MCP access to trusted agent hosts
- Use `neuron purge --force` / backup tools when rotating machines
