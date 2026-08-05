# Security Core

Neuron’s **self-protection** layer (`@neuron-ai-memory/security-core`).

Protects: project memory, secrets, MCP calls, AI context, knowledge integrity.

Does **not** implement antivirus, EDR, custom cryptosystems, or auto-deploy of security fixes.

## Layout

```text
packages/security-core/src/
  secrets/         SecretScanner, EncryptionProvider (abstraction)
  sandbox/         SandboxManager
  permissions/     MCPGuard
  sanitization/    ContextSanitizer
  policies/        Trust, Privacy, PromptInjection, ToolPermission, SourceTrust
  memory/          MemorySecurityManager
  audit/           SecurityAuditLog, security-report.md
  facade/          SecurityCore
```

## SecurityContext

`project` · `trustLevel` · `permissions` · `dataClassification` · `policies` · `privacyMode`

### TrustLevel

`UNKNOWN` → `LIMITED` → `TRUSTED` → `VERIFIED`

### PrivacyMode

`LOCAL_ONLY` (default) · `HYBRID` · `CLOUD_ALLOWED`

## MCP tools

| Tool | Role |
|------|------|
| `neuron_security_check` | Pre-AI check (Cursor) |
| `neuron_security_scan` | Full scan → `security-report.md` |
| `neuron_check_context` | Sanitize before model |
| `neuron_trust_report` | Source trust |
| `neuron_audit_log` | Event history |

Related (codebase advisor): `neuron_security_review` from Security Intelligence.

## Storage

- `.neuron/security-core.json`
- `.neuron/security-audit.json`
- `.neuron/security-report.md`
