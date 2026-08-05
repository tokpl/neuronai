import type { ProjectScaleProfile } from '../types.js';
import { nowIso } from '../types.js';

const DEFAULT_CRITICAL = ['Login', 'Payment', 'Search'];

export class ScaleProfileStore {
  private profile: ProjectScaleProfile = {
    trafficPatterns: [],
    criticalFlows: [...DEFAULT_CRITICAL],
    notes: [],
    updatedAt: nowIso(),
  };

  get(): ProjectScaleProfile {
    return { ...this.profile, criticalFlows: [...this.profile.criticalFlows], trafficPatterns: [...this.profile.trafficPatterns], notes: [...this.profile.notes] };
  }

  load(profile: ProjectScaleProfile): void {
    this.profile = {
      ...profile,
      criticalFlows: profile.criticalFlows?.length ? profile.criticalFlows : [...DEFAULT_CRITICAL],
      trafficPatterns: profile.trafficPatterns ?? [],
      notes: profile.notes ?? [],
      updatedAt: profile.updatedAt ?? nowIso(),
    };
  }

  update(input: Partial<Omit<ProjectScaleProfile, 'updatedAt'>>): ProjectScaleProfile {
    this.profile = {
      ...this.profile,
      ...input,
      criticalFlows: input.criticalFlows ?? this.profile.criticalFlows,
      trafficPatterns: input.trafficPatterns ?? this.profile.trafficPatterns,
      notes: input.notes ?? this.profile.notes,
      updatedAt: nowIso(),
    };
    return this.get();
  }
}

export function createScaleProfileStore(): ScaleProfileStore {
  return new ScaleProfileStore();
}
