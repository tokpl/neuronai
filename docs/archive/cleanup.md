# Cleanup Workflow

```text
Scan
  → StaleMemoryDetector
  → ConflictResolver (supersede suggestions)
  → DuplicateMemoryDetector (merge suggestions)
  → GovernancePolicyEngine (timed reviews)
  → MemoryReviewQueue
  → Cleanup suggestions (requiresApproval)
  → Developer decides
```

## Policies (defaults)

| Policy | Cadence |
|--------|---------|
| Architecture decisions | Review every 90 days |
| Temporary workarounds | Review every 30 days |
| Critical security rules | Never auto-archive |
| Coding patterns | Review every 120 days |

## MaintenanceScheduler

Cadences: `daily` · `weekly` · `manual`  
Prepares checklists only — **no** external cron / cloud schedulers.

## Example conflict

Memory A: “Use REST”  
Memory B: “Moved to GraphQL”  

Suggestion: `REST decision superseded` → mark A as superseded **after approval**.
