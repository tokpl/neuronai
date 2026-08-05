# Onboarding mode (New Developer Mode)

Goal: a new teammate learns the **technical** project brain quickly.

```bash
# MCP
neuron_onboarding
```

## Bundle

Neuron generates:

1. **Project introduction**
2. **Architecture overview**
3. **Important decisions**
4. **Common mistakes**
5. **Security rules**

## Example

```text
New developer → Cursor: "How does this project work?"

Neuron (neuron_onboarding):
  Welcome to Demo Team…
  Architecture: modular monolith…
  Decision: Use PostgreSQL (approved)
  Mistake: Don't put business logic in controllers
  Security: Never commit .env
```

## Permissions

Viewers can run onboarding (**VIEW**). Proposing new shared knowledge requires **SUGGEST**.

Local-first — uses approved TEAM/PROJECT memories only.

See [team-brain.md](./team-brain.md).
