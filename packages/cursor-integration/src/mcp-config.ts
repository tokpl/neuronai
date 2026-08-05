import { z } from 'zod';

export const neuronMcpServerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
});

export const cursorMcpConfigSchema = z.object({
  mcpServers: z.record(z.unknown()).refine((servers) => 'neuron' in servers, {
    message: 'mcpServers.neuron is required',
  }),
});

export interface NeuronMcpEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export function buildNeuronMcpEntry(cwd: string): NeuronMcpEntry {
  return {
    command: 'neuron',
    args: ['mcp'],
    env: {
      NEURON_CWD: cwd,
    },
  };
}

export interface McpValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  neuron?: NeuronMcpEntry;
}

export function validateCursorMcpConfig(raw: unknown): McpValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const top = cursorMcpConfigSchema.safeParse(raw);
  if (!top.success) {
    return {
      ok: false,
      errors: top.error.issues.map((i) => i.message),
      warnings,
    };
  }

  const servers = (raw as { mcpServers: Record<string, unknown> }).mcpServers;
  const neuronRaw = servers['neuron'];
  const neuron = neuronMcpServerSchema.safeParse(neuronRaw);
  if (!neuron.success) {
    return {
      ok: false,
      errors: neuron.error.issues.map((i) => `neuron: ${i.message}`),
      warnings,
    };
  }

  const entry = neuron.data;
  if (entry.command !== 'neuron' && entry.command !== 'pnpm' && entry.command !== 'npx') {
    warnings.push(`Unusual MCP command "${entry.command}" — expected neuron | pnpm | npx`);
  }
  if (entry.command === 'neuron' && !(entry.args ?? []).includes('mcp')) {
    errors.push('neuron MCP entry should include args: ["mcp"]');
  }
  if (!entry.env?.['NEURON_CWD']) {
    warnings.push('NEURON_CWD not set — Neuron will use process cwd of the MCP host');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    neuron: {
      command: entry.command,
      args: entry.args ?? [],
      env: entry.env ?? {},
    },
  };
}

export function mergeNeuronMcpConfig(
  existing: unknown,
  cwd: string,
): { mcpServers: Record<string, unknown> } {
  let servers: Record<string, unknown> = {};
  if (existing && typeof existing === 'object' && 'mcpServers' in existing) {
    const mcp = (existing as { mcpServers?: Record<string, unknown> }).mcpServers;
    if (mcp && typeof mcp === 'object') servers = { ...mcp };
  }
  servers['neuron'] = buildNeuronMcpEntry(cwd);
  return { mcpServers: servers };
}
