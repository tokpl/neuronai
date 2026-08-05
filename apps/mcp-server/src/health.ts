import { createLogger, NEURON_API_VERSION, PACKAGE_VERSION } from '@neuronai/observability';
import type { HealthStatus } from '@neuronai/types';

const startedAt = Date.now();

export const VERSION = PACKAGE_VERSION;

export function getHealth(mode: 'local' | 'cloud' = 'local'): HealthStatus & {
  apiVersion: string;
} {
  return {
    status: 'ok',
    version: VERSION,
    uptimeMs: Date.now() - startedAt,
    mode,
    apiVersion: NEURON_API_VERSION,
  };
}

export const logger = createLogger({ name: 'mcp-server', destination: 'stderr' });
