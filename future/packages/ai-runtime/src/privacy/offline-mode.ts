import type { AiRuntimeConfig } from '../types.js';

export interface OfflineCapabilities {
  projectScanning: boolean;
  graphBuilding: boolean;
  memoryRetrieval: boolean;
  basicAnalysis: boolean;
  cloudModels: boolean;
}

/**
 * Neuron Offline Mode — intelligence without internet.
 */
export class OfflineMode {
  isOffline(config: AiRuntimeConfig): boolean {
    return config.mode === 'offline' || (!config.allowCloud && config.mode === 'local');
  }

  capabilities(config: AiRuntimeConfig): OfflineCapabilities {
    const offline = config.mode === 'offline';
    return {
      projectScanning: true,
      graphBuilding: true,
      memoryRetrieval: true,
      basicAnalysis: true,
      cloudModels: !offline && config.allowCloud,
    };
  }

  describe(): string {
    return [
      'Neuron Offline Mode',
      '  ✓ project scanning',
      '  ✓ graph building',
      '  ✓ memory retrieval',
      '  ✓ basic analysis (heuristic / local models)',
      '  ✗ cloud models',
    ].join('\n');
  }
}

export function createOfflineMode(): OfflineMode {
  return new OfflineMode();
}
