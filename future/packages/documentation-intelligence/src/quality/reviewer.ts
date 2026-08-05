import type {
  DocumentationArtifact,
  DocumentationQualityScore,
  DriftFinding,
} from '../types.js';
import { createDocumentationQualityScorer } from '../quality/score.js';

export class DocumentationReviewer {
  private readonly scorer = createDocumentationQualityScorer();

  review(input: {
    artifacts: DocumentationArtifact[];
    drift: DriftFinding[];
    expectedModules?: number;
    missingHints?: string[];
  }): {
    health: DocumentationQualityScore;
    missing: string[];
    outdated: DocumentationArtifact[];
    incorrect: DriftFinding[];
  } {
    const health = this.scorer.score({
      artifacts: input.artifacts,
      drift: input.drift,
      expectedModules: input.expectedModules,
    });

    const types = new Set(input.artifacts.map((a) => a.type));
    const missing = [
      ...(types.has('ARCHITECTURE_DOC') ? [] : ['ARCHITECTURE_DOC']),
      ...(types.has('ONBOARDING_DOC') ? [] : ['ONBOARDING_DOC']),
      ...(types.has('MODULE_DOC') ? [] : ['MODULE_DOC']),
      ...(input.missingHints ?? []),
    ];

    return {
      health,
      missing,
      outdated: input.artifacts.filter((a) => a.status === 'STALE'),
      incorrect: input.drift,
    };
  }
}

export function createDocumentationReviewer(): DocumentationReviewer {
  return new DocumentationReviewer();
}
