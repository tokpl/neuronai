# Warnings — notify-hub-demo

## Do not poll Postgres for notifications

Polling caused load spikes and duplicate sends. Use Redis streams.

## Do not bypass PermissionService

Direct role string checks in controllers caused privilege bugs.
