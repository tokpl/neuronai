import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConfigError } from '@neuron-ai-memory/types';

import { defaultNeuronConfig, neuronConfigSchema, type NeuronConfig } from './schema.js';

export interface LoadConfigOptions {
  /** Absolute or relative path to neuron.config.json */
  configPath?: string;
  /** When true, missing config file falls back to defaults instead of throwing */
  optional?: boolean;
  cwd?: string;
}

function applyEnvOverrides(config: NeuronConfig): NeuronConfig {
  const logLevel = process.env['LOG_LEVEL'];
  const mode = process.env['NEURON_MODE'];
  const databaseUrl = process.env['DATABASE_URL'];

  const next: NeuronConfig = {
    ...config,
    server: {
      ...config.server,
      mode: mode === 'cloud' || mode === 'local' ? mode : config.server.mode,
    },
  };

  // Preserve unused env awareness for future wiring without mutating schema yet.
  void logLevel;
  void databaseUrl;

  return next;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<NeuronConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(
    cwd,
    options.configPath ?? process.env['NEURON_CONFIG_PATH'] ?? 'neuron.config.json',
  );

  let raw: unknown = defaultNeuronConfig;

  try {
    const text = await readFile(configPath, 'utf8');
    raw = JSON.parse(text) as unknown;
  } catch (error) {
    const isMissing =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'ENOENT';

    if (!isMissing || options.optional === false) {
      if (!isMissing) {
        throw new ConfigError(`Failed to read config at ${configPath}`, {
          configPath,
          cause: String(error),
        });
      }
      if (options.optional === false) {
        throw new ConfigError(`Config file not found: ${configPath}`, { configPath });
      }
    }
  }

  const parsed = neuronConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError('Invalid neuron.config.json', {
      configPath,
      issues: parsed.error.issues,
    });
  }

  return applyEnvOverrides(parsed.data);
}

export function validateConfig(input: unknown): NeuronConfig {
  const parsed = neuronConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new ConfigError('Invalid Neuron configuration', {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}
