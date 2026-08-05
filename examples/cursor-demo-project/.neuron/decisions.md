# Decisions — notify-hub-demo

## Notifications use Redis streams

Problem: fan-out email/push without coupling API to mailer.

Decision: publish domain events to Redis streams; workers consume asynchronously.

Consequences: no DB polling for notifications; horizontal workers are easy.

## Authentication is JWT + RBAC

Problem: need role-based access across API and workers.

Decision: JWT access tokens + central `PermissionService`.

Alternatives rejected: session cookies only; hardcoded role checks in controllers.
