# E-commerce benchmark project

Synthetic fixture for Neuron evaluation.

## Stack

- Frontend: React
- Backend: Node
- Database: PostgreSQL

## Modules

`frontend` · `backend` · `db` · payments · cart · catalog

## Seed decisions (Neuron)

- PostgreSQL is the system of record
- Payments use event sourcing / outbox
- React talks via BFF only
- Do not bypass cart service
