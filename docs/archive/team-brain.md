# Team Brain

Shared **technical** knowledge for a multi-developer project. Not a social network, chat, or public feed.

Package: `@neuron-ai-memory/team-brain` (wraps `@neuron-ai-memory/team-memory`).

## Architecture

```text
packages/team-brain/src/
  members/         NewDeveloperMode, TeamEngineeringTimeline
  permissions/     KnowledgePermissions (VIEW→ADMIN)
  sync/            KnowledgeSyncProvider (local_only | self_hosted stub)
  shared-memory/   SharedMemory, approval, conflicts
  ownership/       MemoryOwnership
  audit/           KnowledgeAuditLog
  facade/          TeamBrain
```

Persistence:

- `.neuron/team/team-memory.json` — records (via team-memory)
- `.neuron/team/team-brain.json` — brain meta + audit + syncMode

## TeamBrain model

`id`, `name`, `projects`, `members`, `sharedKnowledge`, `permissions`, `createdAt`

## Workflow

```text
Senior creates Architecture Decision
  → SharedMemory proposal (REVIEW)
  → Reviewer APPROVES
  → New developer asks Cursor "why?"
  → neuron_team_context / neuron_team_decisions
```

## MCP

- `neuron_team_context`
- `neuron_team_decisions`
- `neuron_onboarding`
- `neuron_team_rules`

See [team-memory.md](./team-memory.md) and [onboarding-mode.md](./onboarding-mode.md).
