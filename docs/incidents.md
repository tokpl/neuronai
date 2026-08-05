# Incidents

## Model

| Field | Notes |
|-------|--------|
| severity | LOW → CRITICAL |
| status | OPEN → INVESTIGATING → RESOLVED → ARCHIVED |
| rootCause / solution / lesson | filled on resolve |
| links | files, commits, decisions, modules |

## Incident memory (after resolve)

Example:

- **Problem:** Users randomly logged out  
- **Root cause:** JWT refresh token expiration mismatch  
- **Solution:** Unified token lifetime configuration  
- **Lesson:** Authentication configuration must stay centralized  

## MCP

- `neuron_create_incident`
- `neuron_search_incidents`
- `neuron_incident_history`
- `neuron_debug_context`
- `neuron_root_cause`
