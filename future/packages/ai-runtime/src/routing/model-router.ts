import type {
  AiRuntimeConfig,
  DataClassification,
  ModelDescriptor,
  ModelSelection,
  PrivacyCheckResult,
  TaskProfileKind,
} from '../types.js';
import { defaultModelCatalog, getTaskProfile } from '../models/task-profiles.js';
import type { PrivacyRouter } from '../privacy/privacy-router.js';

export interface ModelRouterInput {
  task: TaskProfileKind | string;
  text?: string;
  pathHint?: string;
  catalog?: ModelDescriptor[];
  config: AiRuntimeConfig;
}

/**
 * Selects a model by task profile + privacy constraints + preferred provider.
 */
export class ModelRouter {
  constructor(private readonly privacy: PrivacyRouter) {}

  select(input: ModelRouterInput): ModelSelection {
    const profile = getTaskProfile(input.task);
    const privacy = this.privacy.check({
      text: input.text ?? '',
      pathHint: input.pathHint,
      config: input.config,
    });

    const catalog = (input.catalog ?? defaultModelCatalog()).filter((m) => {
      if (privacy.recommendedRoute === 'deny') return false;
      if (
        privacy.recommendedRoute === 'local' ||
        privacy.recommendedRoute === 'offline' ||
        !input.config.allowCloud ||
        input.config.mode === 'local' ||
        input.config.mode === 'offline'
      ) {
        return m.local;
      }
      return true;
    });

    const preferred = input.config.preferredProvider;
    const byTier = catalog.filter((m) => m.tier === profile.recommendedTier);
    const pool = byTier.length ? byTier : catalog;

    let model: ModelDescriptor | undefined;
    if (preferred) {
      model = pool.find((m) => m.providerId === preferred) ?? pool[0];
    } else if (profile.preferredLocal) {
      model = pool.find((m) => m.local) ?? pool[0];
    } else {
      model = pool.find((m) => !m.local) ?? pool.find((m) => m.local) ?? pool[0];
    }

    if (!model) {
      model = defaultModelCatalog().find((m) => m.id === 'offline-heuristic')!;
    }

    const reason = buildReason(profile.kind, model, privacy, preferred);
    return {
      model,
      providerId: model.providerId,
      reason,
      profile,
      privacy,
    };
  }
}

function buildReason(
  task: string,
  model: ModelDescriptor,
  privacy: PrivacyCheckResult,
  preferred?: string,
): string {
  const bits = [
    `Task ${task} → tier ${model.tier}`,
    model.local ? 'local model' : 'cloud model',
    `privacy route=${privacy.recommendedRoute}`,
  ];
  if (preferred) bits.push(`preferredProvider=${preferred}`);
  return bits.join('; ');
}

export function createModelRouter(privacy: PrivacyRouter): ModelRouter {
  return new ModelRouter(privacy);
}

export type { DataClassification };
