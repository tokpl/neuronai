import type { SecurityPermission, ToolPermissionEffect } from '../types.js';

const DEFAULT_TOOLS: SecurityPermission[] = [
  { id: 'read_files', effect: 'allowed', description: 'Read files' },
  { id: 'delete_files', effect: 'blocked', description: 'Delete files' },
  {
    id: 'network_request',
    effect: 'requires_approval',
    description: 'Network request',
  },
  { id: 'run_script', effect: 'blocked', description: 'Run unknown scripts' },
  {
    id: 'automatic_commands',
    effect: 'blocked',
    description: 'Automatic shell commands',
  },
];

/** Map MCP / capability ids → permission effects */
const TOOL_ALIASES: Record<string, string> = {
  neuron_get_context: 'read_files',
  neuron_search_memory: 'read_files',
  neuron_store_memory: 'write_memory',
  neuron_save_decision: 'write_memory',
  neuron_update_memory: 'write_memory',
  fs_delete: 'delete_files',
  http_fetch: 'network_request',
  shell_exec: 'run_script',
};

export class ToolPermissionPolicy {
  private permissions: Map<string, SecurityPermission>;

  constructor(initial: SecurityPermission[] = DEFAULT_TOOLS) {
    this.permissions = new Map(initial.map((p) => [p.id, p]));
  }

  list(): SecurityPermission[] {
    return [...this.permissions.values()];
  }

  set(id: string, effect: ToolPermissionEffect, description?: string): void {
    this.permissions.set(id, { id, effect, description });
  }

  resolve(toolOrCapability: string): SecurityPermission {
    const key = TOOL_ALIASES[toolOrCapability] ?? toolOrCapability;
    return (
      this.permissions.get(key) ?? {
        id: key,
        effect: 'requires_approval',
        description: 'Unknown tool — requires approval',
      }
    );
  }

  effectFor(toolOrCapability: string): ToolPermissionEffect {
    return this.resolve(toolOrCapability).effect;
  }
}

export function createToolPermissionPolicy(
  initial?: SecurityPermission[],
): ToolPermissionPolicy {
  return new ToolPermissionPolicy(initial);
}
