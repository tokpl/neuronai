import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  neuronLocalConfigSchema,
  type NeuronLocalConfig,
} from './local-config.js';

export interface ConfigIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConfigValidationResult {
  ok: boolean;
  config?: NeuronLocalConfig;
  issues: ConfigIssue[];
}

/**
 * Validates `.neuron/config.json` shape, providers, and paths.
 * Telemetry defaults to OFF; cloud server mode is a warning (local-first).
 */
export class ConfigValidator {
  validate(input: unknown, cwd = process.cwd()): ConfigValidationResult {
    const issues: ConfigIssue[] = [];
    const parsed = neuronLocalConfigSchema.safeParse(input);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
          severity: 'error',
        });
      }
      return { ok: false, issues };
    }

    const config = parsed.data;

    if (config.server.mode === 'cloud') {
      issues.push({
        path: 'server.mode',
        message: 'Cloud mode is not supported yet — use local.',
        severity: 'warning',
      });
    }

    if (config.privacy.telemetry === true) {
      issues.push({
        path: 'privacy.telemetry',
        message: 'Telemetry is enabled — Neuron never sends source code, but metrics are optional.',
        severity: 'warning',
      });
    }

    if (config.privacy.localOnly === false && config.server.mode !== 'local') {
      issues.push({
        path: 'privacy.localOnly',
        message: 'localOnly is false while server is not local.',
        severity: 'warning',
      });
    }

    const providers = config.providers ?? {};
    for (const [name, provider] of Object.entries(providers)) {
      // Built-in "local" provider does not require a remote model id.
      if (provider.enabled && !provider.model && name !== 'none' && name !== 'local') {
        issues.push({
          path: `providers.${name}.model`,
          message: `Provider "${name}" is enabled but model is missing.`,
          severity: 'warning',
        });
      }
    }

    for (const ignore of config.scan.ignore ?? []) {
      if (ignore.includes('..') || ignore.startsWith('/') || /^[A-Za-z]:/.test(ignore)) {
        issues.push({
          path: 'scan.ignore',
          message: `Suspicious ignore path: ${ignore}`,
          severity: 'warning',
        });
      }
    }

    void cwd;
    const hasErrors = issues.some((i) => i.severity === 'error');
    return { ok: !hasErrors, config, issues };
  }

  async validatePaths(cwd: string, config: NeuronLocalConfig): Promise<ConfigIssue[]> {
    const issues: ConfigIssue[] = [];
    for (const rel of config.scan.ignore ?? []) {
      // Ignore globs do not need to exist; only flag absolute escapes already handled.
      if (rel.trim() === '') {
        issues.push({
          path: 'scan.ignore',
          message: 'Empty ignore entry.',
          severity: 'error',
        });
      }
    }

    try {
      await access(resolve(cwd), constants.R_OK | constants.W_OK);
    } catch {
      issues.push({
        path: '(cwd)',
        message: `Cannot read/write project directory: ${cwd}`,
        severity: 'error',
      });
    }

    return issues;
  }
}

export function createConfigValidator(): ConfigValidator {
  return new ConfigValidator();
}
