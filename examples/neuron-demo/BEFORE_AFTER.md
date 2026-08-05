# BEZ NEURON vs Z NEURON

## Developer

> Add payment system

## BEZ NEURON

AI nie zna:

- istniejącej architektury (apps/web + apps/api + packages/db)
- decyzji (event-driven payments / outbox)
- ograniczeń (zakaz bezpośredniego SQL w kontrolerach)

Typowy wynik: nowy client DB w `apps/api/routes`, pominięty outbox, niespójny model transakcji.

## Z NEURON

Cursor → `neuron_prepare_task`

Neuron zwraca (przykład):

**Architecture**

Payment module follows existing transaction pattern (`packages/domain`).

**Warnings**

Do not access database directly from HTTP controllers — use `packages/db`.

**Decisions**

Payments use event-driven flow (outbox → worker).

Potem plan i implementacja **rozszerzają** ten wzorzec zamiast go zastępować.
