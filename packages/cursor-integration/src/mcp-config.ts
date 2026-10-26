import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/**
 * Resolve the neuronai CLI entry for MCP.
 * Prefer `node` + absolute `index.js` (Cursor + doctor can spawn without a shell).
 * Avoid bare `npx.cmd` on Windows — Node 20+ rejects spawning `.cmd`/`.bat` without
 * `shell: true` (`spawn EINVAL`).
 */
export function resolveNeuronCliInvocation(cwd: string): { command: string; args: string[] } {
  const here = dirname(fileURLToPath(import.meta.url));
  const runningEntry = fileURLToPath(import.meta.url);
  const candidates = [
    // Bundled CLI (`neuronai/dist/index.js`) — same process that runs `neuron cursor setup`
    ...(/(^|[/\\])dist[/\\]index\.js$/i.test(runningEntry) ? [runningEntry] : []),
    // packages/cursor-integration/{src|dist} → apps/cli/dist
    join(here, '..', '..', '..', 'apps', 'cli', 'dist', 'index.js'),
    join(here, '..', '..', 'apps', 'cli', 'dist', 'index.js'),
    // project-local / global install
    join(cwd, 'node_modules', 'neuronai', 'dist', 'index.js'),
    join(cwd, 'apps', 'cli', 'dist', 'index.js'),
    process.env.APPDATA
      ? join(process.env.APPDATA, 'npm', 'node_modules', 'neuronai', 'dist', 'index.js')
      : '',
    process.env.npm_config_prefix
      ? join(process.env.npm_config_prefix, 'node_modules', 'neuronai', 'dist', 'index.js')
      : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const abs = resolve(candidate);
    if (existsSync(abs)) {
      return {
        command: process.execPath,
        args: [abs, 'mcp'],
      };
    }
  }

  // Last resort: npx (doctor probe enables shell for .cmd on Windows)
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return {
    command: npxCmd,
    args: ['-y', 'neuronai', 'mcp'],
  };
}

export function buildNeuronMcpEntry(cwd: string): NeuronMcpEntry {
  const inv = resolveNeuronCliInvocation(cwd);
  return {
    command: inv.command,
    args: inv.args,
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

const OK_COMMANDS = new Set(['neuron', 'neuronai', 'npx', 'npx.cmd', 'pnpm', 'node', 'node.exe']);

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
  const cmdBase = entry.command.replace(/^.*[/\\]/, '').toLowerCase();
  if (!OK_COMMANDS.has(cmdBase) && !OK_COMMANDS.has(entry.command)) {
    warnings.push(
      `Unusual MCP command "${entry.command}" - expected node | npx | neuronai | neuron`,
    );
  }
  const args = entry.args ?? [];
  if (!args.includes('mcp')) {
    errors.push('neuron MCP entry should include args ending with "mcp"');
  }
  if (!entry.env?.['NEURON_CWD']) {
    warnings.push('NEURON_CWD not set - Neuron will use process cwd of the MCP host');
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
