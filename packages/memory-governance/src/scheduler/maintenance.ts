import type { MaintenanceCadence, MaintenanceConfig } from '../types.js';
import { nowIso } from '../types.js';

export interface MaintenancePlan {
  cadence: MaintenanceCadence;
  enabled: boolean;
  description: string;
  suggestedChecks: string[];
  nextHint: string;
  /** Local marker only — no OS/cloud cron unless explicitly enabled later */
  preparedAt: string;
}

/**
 * Scheduled maintenance — default OFF.
 * Does not register OS/cloud schedulers by itself.
 */
export class MaintenanceScheduler {
  private config: MaintenanceConfig = { enabled: false, cadence: 'weekly' };

  getConfig(): MaintenanceConfig {
    return { ...this.config };
  }

  setConfig(patch: Partial<MaintenanceConfig>): MaintenanceConfig {
    this.config = {
      enabled: patch.enabled ?? this.config.enabled,
      cadence: patch.cadence ?? this.config.cadence,
    };
    return this.getConfig();
  }

  plan(cadence: MaintenanceCadence = this.config.cadence): MaintenancePlan {
    const checks = [
      'Run stale memory detection against current code signals',
      'Detect decision conflicts and duplicate clusters',
      'Apply decay adjustments (confidence/importance) — never delete',
      'Rebuild review queue from governance policies',
      'Write .neuron/memory-health.md',
    ];

    const description =
      cadence === 'daily'
        ? 'Light daily scan — conflicts + high-priority stale'
        : cadence === 'weekly'
          ? 'Full weekly brain maintenance'
          : 'On-demand manual maintenance';

    const nextHint = !this.config.enabled
      ? 'Maintenance is OFF by default. Enable explicitly or run neuron_memory_cleanup manually.'
      : cadence === 'daily'
        ? 'Run again tomorrow or after large merges'
        : cadence === 'weekly'
          ? 'Run again next week or after architecture changes'
          : 'Invoke neuron_memory_health when ready';

    return {
      cadence,
      enabled: this.config.enabled,
      description,
      suggestedChecks: checks,
      nextHint,
      preparedAt: nowIso(),
    };
  }
}

export function createMaintenanceScheduler(): MaintenanceScheduler {
  return new MaintenanceScheduler();
}
