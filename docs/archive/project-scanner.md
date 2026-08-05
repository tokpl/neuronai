# Project Scanner

Neuron’s **Project Brain Bootstrap Engine** — after `neuron init` / `neuron scan`, the repo gets a starter brain without hand-written memories.

## Workflow

```text
neuron init / neuron scan
        │
        ▼
 CodebaseScanner (filtered)
        │
        ├── TechnologyDetector
        ├── DependencyGraphBuilder
        ├── ArchitectureAnalyzer
        ├── CodeRelationshipAnalyzer
        ├── GitAnalyzer
        └── DocumentationAnalyzer
                │
                ▼
     Initial memories + suggested constitution
     .neuron/architecture.md
     .neuron/project-report.md
     .cursor/rules/project-patterns.mdc
```

Package: `@neuron-ai-memory/project-scanner`

## Scan modes

| Mode | Flag | Focus |
|------|------|--------|
| Fast | default | stack, structure, deps, docs, git sample |
| Deep | `--deep` | + code relationships |
| Architecture | `--architecture` | architecture map + relations |
| Update | `--update` | incremental via mtime/hash cache |

## Security

`SensitiveFileDetector` skips `.env`, credentials, private keys, PEM/keystore files.

## Performance

- Directory queue + concurrent reads
- Caps for large trees (tens of thousands of files)
- `scan-cache.json` for incremental updates

See [first-scan.md](./first-scan.md) and [project-brain.md](./project-brain.md).
