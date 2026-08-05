import type { DeploymentMode, EnvironmentConfig } from '../types.js';

/**
 * Self-host / enterprise foundation config.
 * Prepares env + storage + auth hooks — no public server.
 */
export class EnvironmentConfigLoader {
  fromProcessEnv(
    env: NodeJS.ProcessEnv = process.env,
    defaults?: Partial<EnvironmentConfig>,
  ): EnvironmentConfig {
    const mode = (env['NEURON_DEPLOYMENT_MODE'] ??
      defaults?.deploymentMode ??
      'LOCAL') as DeploymentMode;
    const storageBackend = (env['NEURON_STORAGE_BACKEND'] ??
      defaults?.storageBackend ??
      'file') as EnvironmentConfig['storageBackend'];

    return {
      deploymentMode: mode,
      storageBackend,
      databaseUrl: env['DATABASE_URL'] ?? defaults?.databaseUrl,
      authMode: (env['NEURON_AUTH_MODE'] as EnvironmentConfig['authMode']) ?? 'none',
      dataRoot: env['NEURON_DATA_ROOT'] ?? defaults?.dataRoot ?? '.neuron',
      organizationId: env['NEURON_ORGANIZATION_ID'] ?? defaults?.organizationId,
      workspaceId: env['NEURON_WORKSPACE_ID'] ?? defaults?.workspaceId,
      projectId: env['NEURON_PROJECT_ID'] ?? defaults?.projectId,
    };
  }

  /**
   * Merge .env-style map + optional config file object.
   */
  merge(
    fileConfig: Partial<EnvironmentConfig> | undefined,
    env: NodeJS.ProcessEnv = process.env,
  ): EnvironmentConfig {
    const fromEnv = this.fromProcessEnv(env, fileConfig);
    return { ...fromEnv, ...fileConfig };
  }
}

export interface DeploymentProfile {
  mode: DeploymentMode;
  allowsMultiWorkspace: boolean;
  allowsRemoteDb: boolean;
  requiresAuth: boolean;
  publicServer: false;
  notes: string[];
}

export class DeploymentModeResolver {
  resolve(mode: DeploymentMode): DeploymentProfile {
    switch (mode) {
      case 'LOCAL':
        return {
          mode,
          allowsMultiWorkspace: true,
          allowsRemoteDb: false,
          requiresAuth: false,
          publicServer: false,
          notes: [
            'Single machine / developer laptop',
            'File or SQLite storage',
            'No public accounts',
          ],
        };
      case 'SELF_HOSTED':
        return {
          mode,
          allowsMultiWorkspace: true,
          allowsRemoteDb: true,
          requiresAuth: true,
          publicServer: false,
          notes: [
            'Org-run Neuron instance',
            'Postgres optional',
            'Auth hook ready (OIDC future) — no public SaaS',
          ],
        };
      case 'ENTERPRISE':
        return {
          mode,
          allowsMultiWorkspace: true,
          allowsRemoteDb: true,
          requiresAuth: true,
          publicServer: false,
          notes: [
            'Hardened policies + audit retention',
            'Workspace/project isolation required',
            'Still not a billing/subscription product',
          ],
        };
    }
  }
}

export function createEnvironmentConfigLoader(): EnvironmentConfigLoader {
  return new EnvironmentConfigLoader();
}

export function createDeploymentModeResolver(): DeploymentModeResolver {
  return new DeploymentModeResolver();
}
