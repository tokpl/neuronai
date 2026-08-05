# Project Constitution

Project: **shoplite-neuron-demo**

_How this project should be developed. Seeded for the public demo — approve via Neuron in real projects._

## Architecture

- Use service / domain helpers for business transactions
- No direct database access from controllers — use `packages/db`

## Database

- Persist payment intents via outbox events (event-driven flow)

## Security

- Never bypass permission checks when auth modules exist *[warning]*

## Known mistakes

- **Do not access database directly**: Never `import pg` inside `apps/api` route handlers.
