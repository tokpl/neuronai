# Architecture rules

`ArchitectureRuleEngine` enforces design constraints:

| Rule ID | Intent |
|---------|--------|
| `core-no-app-deps` | Core cannot depend on application |
| `interface-communication` | Prefer facades/interfaces for high fan-out |
| `security-not-bypassed` | Application → storage should not skip security |
| `storage-abstraction` | Concrete DB access belongs behind storage abstractions |

Violations feed the health score and refactor plans. Re-run `neuron_architecture_scan` after intentional layering changes.
