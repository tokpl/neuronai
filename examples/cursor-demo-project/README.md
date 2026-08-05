# Cursor demo project — “NotifyHub”

Tiny fictional app that shows **before vs after** Neuron.

## Before Neuron

Ask Cursor: *“Add email digests for failed jobs.”*

Typical agent behavior without memory:

- Invents a new queue library
- Polls the database
- Ignores that the app already uses Redis streams
- Re-debates JWT vs sessions

## After Neuron

```bash
# from monorepo root
pnpm build
pnpm neuron init cursor --force
# or point NEURON_CWD here after copying brain files
```

With seeded brain (see `.neuron/` in this folder):

- Architecture: Nest-style modules + Redis streams
- Decision: notifications go through Redis, not DB polling
- Warning: never bypass `PermissionService`
- Pattern: job failures emit `job.failed` events

Ask again: *“Add email digests for failed jobs.”*  
Expect `neuron_get_context` / `neuron_prepare_task` and a plan that extends Redis + existing events.

## Demo prompts

1. `/neuron-explain` — architecture overview  
2. `/neuron-context` — “email digests for failed jobs”  
3. `/neuron-plan` — implementation steps  
4. `/neuron-save` — after choosing SES vs SMTP
