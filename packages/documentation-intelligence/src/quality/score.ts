import type {
  DocumentationArtifact,
  DocumentationQualityScore,
  DriftFinding,
} from '../types.js';

export class DocumentationQualityScorer {
  score(input: {
    artifacts: DocumentationArtifact[];
    drift: DriftFinding[];
    expectedModules?: number;
    hasManualDocs?: boolean;
  }): DocumentationQualityScore {
    const notes: string[] = [];
    const artifacts = input.artifacts;

    const types = new Set(artifacts.map((a) => a.type));
    const coverageParts = [
      types.has('ARCHITECTURE_DOC'),
      types.has('ONBOARDING_DOC'),
      types.has('API_DOC') || types.has('PROJECT_OVERVIEW'),
      types.has('MODULE_DOC'),
      types.has('DECISION_DOC') || types.has('CHANGELOG'),
    ];
    const coverage = Math.round(
      (coverageParts.filter(Boolean).length / coverageParts.length) * 100,
    );

    const highDrift = input.drift.filter((d) => d.severity === 'HIGH').length;
    const medDrift = input.drift.filter((d) => d.severity === 'MEDIUM').length;
    let accuracy = 100 - highDrift * 20 - medDrift * 10;
    accuracy = clamp(accuracy);
    if (highDrift) notes.push(`${highDrift} high-severity doc drift finding(s)`);

    const now = Date.now();
    const ages = artifacts.map((a) => now - Date.parse(a.lastUpdated));
    const avgAgeDays =
      ages.length === 0 ? 30 : ages.reduce((a, b) => a + b, 0) / ages.length / 86_400_000;
    let freshness = avgAgeDays < 7 ? 95 : avgAgeDays < 30 ? 80 : avgAgeDays < 90 ? 60 : 40;
    if (artifacts.some((a) => a.status === 'STALE')) {
      freshness = Math.min(freshness, 50);
      notes.push('Stale artifacts present');
    }

    const moduleDocs = artifacts.filter((a) => a.type === 'MODULE_DOC').length;
    const expected = input.expectedModules ?? Math.max(moduleDocs, 1);
    const moduleCoverage = Math.min(100, Math.round((moduleDocs / expected) * 100));
    const consistencyBase = artifacts.length
      ? Math.round(
          (artifacts.filter((a) => a.source === 'generated' || a.source === 'hybrid').length /
            artifacts.length) *
            100,
        )
      : 50;
    const consistency = clamp(
      Math.round(consistencyBase * 0.6 + moduleCoverage * 0.4) -
        (input.hasManualDocs === false ? 5 : 0),
    );

    const overall = Math.round(
      accuracy * 0.35 + freshness * 0.25 + coverage * 0.25 + consistency * 0.15,
    );

    if (coverage < 60) notes.push('Documentation coverage incomplete');
    if (!notes.length) notes.push('Documentation health looks solid');

    return {
      overall: clamp(overall),
      accuracy: clamp(accuracy),
      freshness: clamp(freshness),
      coverage: clamp(coverage),
      consistency: clamp(consistency),
      notes,
    };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function createDocumentationQualityScorer(): DocumentationQualityScorer {
  return new DocumentationQualityScorer();
}
