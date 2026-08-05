# Security workflow

```text
"Add admin dashboard"
        │
        ▼
 neuron_security_context
   → security rules, patterns, risks
        │
        ▼
 Developer implements (human-controlled)
        │
        ▼
 neuron_check_change_security  (diff / paths)
        │
        ▼
 neuron_security_review  (QUICK | DEEP | CHANGE)
        │
        ▼
 security-report.md  (+ optional constitution SECURITY rules)
```

## MCP tools

- `neuron_security_context`
- `neuron_security_review`
- `neuron_threat_model`
- `neuron_security_history`
- `neuron_check_change_security`

## Security Constitution

Baseline suggestions (accept via Project Constitution):

- Secrets must never be committed
- All admin actions require audit logging
- All database writes require validation
