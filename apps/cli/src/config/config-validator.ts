import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

import { neuronLocalConfigSchema, type NeuronLocalConfig } from './local-config.js';

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

/** Validates the shape of `.neuron/prefs.json` and the paths it references. */
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

    // Neuron never sends anything anywhere; these flags exist so a user can see
    // that in their own config, and so a bad edit is caught rather than honoured.
    if (config.privacy.telemetry === true) {
      issues.push({
        path: 'privacy.telemetry',
        message: 'Neuron has no telemetry. Set privacy.telemetry to false.',
        severity: 'warning',
      });
    }

    if (config.privacy.localOnly === false) {
      issues.push({
        path: 'privacy.localOnly',
        message: 'Neuron is local-only. Set privacy.localOnly to true.',
        severity: 'warning',
      });
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
