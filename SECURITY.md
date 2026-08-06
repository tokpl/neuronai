# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |
| 0.1.x   | No — superseded by the 0.2 rearchitecture |

Pre-1.0: fixes land on the default branch first.

## Reporting a vulnerability

**Do not** open a public issue for security-sensitive reports.

Prefer:

1. GitHub Security Advisories, or
2. A private report to the maintainers.

Include steps to reproduce, impact assessment, and any suggested fix.

## Threat model

Neuron runs entirely on your machine. There is no server, no account and no network client.

| Surface | Exposure |
| --- | --- |
| Data leaving the device | None. Verifiable with `pnpm verify:offline`. |
| Authentication | None required — there is nothing remote to authenticate to. |
| Network listeners | None. The MCP server speaks stdio to its parent process. |
| Third-party services | None. No AI provider, no analytics, no update check. |

The only trust boundary is the MCP stdio channel between Neuron and your editor.

## Secrets

- Neuron never reads `.env` files and never stores their contents
- Memory contents are written by you or proposed for your approval — review before accepting
- Never paste credentials into `neuron remember`
- Treat `.neuron/brain/` as as sensitive as the source it describes

## Telemetry

There is none. Not opt-in, not anonymous, not aggregate. `neuron doctor` verifies the setting
has not been tampered with, and `pnpm verify:offline` proves the runtime makes no network calls
at all by running it with sockets, DNS and `fetch` disabled.

## Operator guidance

- Prefer per-project brains; do not share `.neuron/` across unrelated codebases
- Restrict MCP access to trusted editor hosts
- `neuron reset --force` removes the brain completely; nothing is retained elsewhere

See also [docs/privacy.md](./docs/privacy.md).
