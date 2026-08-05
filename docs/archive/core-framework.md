# Core Framework

Internal modular architecture for Neuron.

**Not** a public plugin system. **No** marketplace, third-party extensions, or dynamic unsafe code loading.

Package: `@neuron-ai-memory/core-framework`

## Goals

- Each major subsystem is a **NeuronModule**
- Modules communicate via **interfaces**, **events**, and **services**
- Only Neuron-owned modules are allowed

## Layout

```text
packages/core-framework/src/
  modules/         Core module descriptors
  lifecycle/       load → initialize → validate → run → shutdown
  events/          NeuronEventBus
  interfaces/      NeuronModule contract
  registry/        ModuleRegistry + NeuronContainer
  configuration/   NeuronConfig (project > env > default)
  api/             Internal Core API (not a public SDK)
  errors/          NeuronErrorSystem
  facade/          CoreFramework
```

See [module-system.md](./module-system.md) and [internal-api.md](./internal-api.md).
