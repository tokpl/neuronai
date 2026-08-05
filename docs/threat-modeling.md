# Threat modeling

`ThreatModelGenerator` builds a lightweight model from architecture signals:

| Element | Example |
|---------|---------|
| Assets | User data |
| Entry points | API, Admin UI, Webhooks |
| Trust boundaries | Client ↔ API, API ↔ DB |
| Risks | Unauthorized access to User data via API |

Example risk row:

- **Asset:** User data  
- **Entry point:** API  
- **Risk:** Unauthorized access  
- **Severity:** MEDIUM / HIGH  

Always advisory — use `neuron_threat_model` from Cursor/MCP.
