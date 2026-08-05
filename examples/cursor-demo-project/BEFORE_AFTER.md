BEFORE Neuron
=============
User: "Add email digests for failed jobs."

Agent (no memory):
- Proposes BullMQ + Postgres LISTEN
- Redesigns auth "just in case"
- Misses existing Redis streams and job.failed pattern

AFTER Neuron
============
User: "Add email digests for failed jobs."

Agent:
1. neuron_get_context → Redis streams, job.failed, PermissionService warning
2. Plan: new worker on notifications stream, SES/SMTP adapter
3. Implement without inventing a second queue
4. neuron_after_task → optionally save "digests use SES"
