import { join } from 'node:path';

import { createWorkspaceCore } from '@neuron-ai-memory/workspace-core';

import type { NeuronRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

function neuronDir(runtime: NeuronRuntime): string {
  return runtime.dataDir ? join(runtime.dataDir, '..') : join(runtime.cwd, '.neuron');
}

async function loadCore(runtime: NeuronRuntime) {
  const core = createWorkspaceCore();
  await core.load(neuronDir(runtime));
  if (!core.registry.listWorkspaces().length) {
    const name = runtime.project?.name ?? runtime.project?.projectId ?? 'Local Project';
    core.ensureBootstrapped(String(name));
    await core.save(neuronDir(runtime));
  }
  return core;
}

export async function handleWorkspaceInfo(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const core = await loadCore(runtime);
    return okResult(core.workspaceInfo());
  } catch (e) {
    return failResult(e);
  }
}

export async function handleProjectSwitch(
  runtime: NeuronRuntime,
  args: { projectId?: string; projectName?: string; memberId?: string },
) {
  try {
    const core = await loadCore(runtime);
    let targetId = args.projectId;
    if (!targetId && args.projectName) {
      const match = core.registry
        .listProjects()
        .find((p) => p.name.toLowerCase() === args.projectName!.toLowerCase());
      targetId = match?.id;
    }
    if (!targetId) {
      return failResult(new Error('Provide projectId or projectName'));
    }
    const result = core.switchProject(targetId, args.memberId);
    await core.save(neuronDir(runtime));
    return okResult({
      ...result,
      note: 'Active MCP project context updated (local foundation).',
    });
  } catch (e) {
    return failResult(e);
  }
}

export async function handleAccessCheck(
  runtime: NeuronRuntime,
  args: {
    projectId?: string;
    resource: 'memory' | 'documents' | 'decisions' | 'security_reports' | 'workspace_settings' | 'members';
    memberId?: string;
    workspaceId?: string;
  },
) {
  try {
    const core = await loadCore(runtime);
    const result = core.accessCheck({
      resource: args.resource,
      memberId: args.memberId,
      workspaceId: args.workspaceId,
    });
    await core.save(neuronDir(runtime));
    return okResult(result);
  } catch (e) {
    return failResult(e);
  }
}

export async function handleStorageStatus(
  runtime: NeuronRuntime,
  _args: { projectId?: string },
) {
  try {
    const core = await loadCore(runtime);
    const status = await core.storageStatus();
    const env = core.getEnvironment();
    const deployment = core.deployment.resolve(env.deploymentMode);
    return okResult({
      storage: status,
      environment: env,
      deployment,
      note: 'Storage abstraction foundation — no SaaS multi-tenant cloud.',
    });
  } catch (e) {
    return failResult(e);
  }
}
