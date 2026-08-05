# Patterns — notify-hub-demo

## job.failed event

When a job fails permanently, emit `job.failed` with `{ jobId, reason, attempts }`.

Digest/email features should subscribe to this event — do not re-scan the jobs table.

## Standard API envelope

All JSON responses use `{ data, error, meta }`.
