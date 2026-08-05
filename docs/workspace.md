# Workspace system

Enterprise architecture foundation for Neuron (`@neuron-ai-memory/workspace-core`).

Supports many users, projects, and workspaces — **without** SaaS billing, subscriptions, or public accounts.

## Model

```text
Organization
  └─ Workspace(s)
       ├─ Members (OWNER | ADMIN | MEMBER | VIEWER)
       ├─ AccessPolicy
       └─ Projects (isolated memory / graph / config / security)
```

## Project isolation

Each project gets:

- `memorySpaceId`
- `knowledgeGraphId`
- `configScope`
- `securityPolicyId`

## MCP tools

| Tool | Purpose |
|------|---------|
| `neuron_workspace_info` | Org + workspace + active project |
| `neuron_project_switch` | Change active project |
| `neuron_access_check` | Role × resource permission |
| `neuron_storage_status` | Storage + deployment mode |

## MCP context

`WorkspaceContextResolver` ensures every MCP request knows **workspace**, **project**, and **permissions**.

Persist: `.neuron/workspace.json`
