import type { DetectedPattern, ModuleNode } from '../types.js';

/**
 * Lightweight pattern cues from module names / responsibilities.
 */
export class PatternDetector {
  detect(modules: ModuleNode[]): DetectedPattern[] {
    const found = new Set<DetectedPattern>();
    const blob = modules
      .map((m) => `${m.name} ${(m.responsibilities ?? []).join(' ')}`)
      .join(' ')
      .toLowerCase();

    if (/repository|repo\b/.test(blob)) found.add('repository');
    if (/\bservice\b|application service/.test(blob)) found.add('service');
    if (/event.?bus|event.?driven|pubsub|publish/.test(blob)) found.add('event_driven');
    if (/dependency.?injection|\bdi\b|container|inject/.test(blob)) {
      found.add('dependency_injection');
    }
    if (!found.size) found.add('unknown');
    return [...found];
  }
}

export function createPatternDetector(): PatternDetector {
  return new PatternDetector();
}
