# Architecture — notify-hub-demo

Stack: javascript, express, redis

## Notes

- HTTP API under `src/api`
- Background workers under `src/workers`
- Events published to Redis streams (`jobs`, `notifications`)
- Auth via JWT + RBAC (`PermissionService`)

Generated for the Cursor demo. Run `neuron analyze` in a real project to refresh.
