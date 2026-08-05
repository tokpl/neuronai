import { redactSecrets } from '@neuron-ai-memory/security';

import type {
  AiRuntimeConfig,
  DataClassification,
  PrivacyCheckResult,
} from '../types.js';
import { ContextClassifier } from '../context/classifier.js';

export interface PrivacyCheckInput {
  text: string;
  pathHint?: string;
  config: AiRuntimeConfig;
}

const SECRET_HINT =
  /\b(api[_-]?key|secret|password|passwd|token|authorization|sk-|ghp_|BEGIN (RSA )?PRIVATE KEY)\b/i;

/**
 * Gates outbound AI calls — local-only, secrets, cloud block.
 * Never logs raw prompts with secrets (use redactSecrets).
 */
export class PrivacyRouter {
  private readonly classifier = new ContextClassifier();

  check(input: PrivacyCheckInput): PrivacyCheckResult {
    const classification = this.classifier.classify(input.pathHint, input.text);
    const containsSecrets =
      SECRET_HINT.test(input.text) ||
      redactSecrets(input.text) !== input.text;

    const cloudDisabled =
      !input.config.allowCloud ||
      input.config.mode === 'offline' ||
      input.config.mode === 'local';

    if (classification === 'CRITICAL') {
      return {
        allowed: true,
        classification,
        containsSecrets: true,
        localOnlyRequired: true,
        cloudBlocked: true,
        reason: 'CRITICAL data cannot leave the machine',
        recommendedRoute: input.config.mode === 'offline' ? 'offline' : 'local',
      };
    }

    if (containsSecrets || classification === 'SENSITIVE') {
      return {
        allowed: true,
        classification,
        containsSecrets: containsSecrets || classification === 'SENSITIVE',
        localOnlyRequired: true,
        cloudBlocked: true,
        reason: containsSecrets
          ? 'Secrets detected — local/offline only'
          : `Classification ${classification} requires local processing`,
        recommendedRoute: input.config.mode === 'offline' ? 'offline' : 'local',
      };
    }

    if (cloudDisabled) {
      return {
        allowed: true,
        classification,
        containsSecrets: false,
        localOnlyRequired: true,
        cloudBlocked: true,
        reason: 'Cloud disabled in .neuron/ai.json (allowCloud=false or mode=local|offline)',
        recommendedRoute: input.config.mode === 'offline' ? 'offline' : 'local',
      };
    }

    return {
      allowed: true,
      classification,
      containsSecrets: false,
      localOnlyRequired: false,
      cloudBlocked: false,
      reason: 'Cloud allowed for this classification with user consent policy',
      recommendedRoute: 'cloud',
    };
  }

  /** Safe-for-logs view of a prompt */
  sanitizeForLog(text: string): string {
    return redactSecrets(text).slice(0, 200);
  }
}

export function createPrivacyRouter(): PrivacyRouter {
  return new PrivacyRouter();
}

export type { DataClassification };
