import { getModeById, listModes } from '../modes/builtin.js';
import type { ModeId, NeuronMode } from '../types.js';

interface RoutePattern {
  modeId: ModeId;
  patterns: RegExp[];
  boost: number;
}

const ROUTES: RoutePattern[] = [
  {
    modeId: 'performance',
    boost: 10,
    patterns: [
      /why\s+is\s+this\s+slow/i,
      /\b(slow|latency|bottleneck|perf(ormance)?|optimize|n\+1|timeout)\b/i,
    ],
  },
  {
    modeId: 'security_review',
    boost: 10,
    patterns: [
      /\b(security|secret|vulnerab|threat|owasp|authn|authz|xss|injection)\b/i,
      /security\s+review/i,
    ],
  },
  {
    modeId: 'debug',
    boost: 9,
    patterns: [
      /\b(bug|crash|error|exception|stack\s*trace|root\s*cause|reproduce|incident)\b/i,
      /why\s+(does|is|did)\s+this\s+fail/i,
    ],
  },
  {
    modeId: 'architect',
    boost: 9,
    patterns: [
      /\b(architect|design\s+system|tradeoff|scalability|boundary|module\s+map)\b/i,
      /how\s+should\s+(we|i)\s+(structure|design)/i,
    ],
  },
  {
    modeId: 'refactoring',
    boost: 8,
    patterns: [
      /\b(refactor|tech\s*debt|migrate|cleanup|split\s+module)\b/i,
      /improve\s+(this\s+)?(code|structure)/i,
    ],
  },
  {
    modeId: 'code_review',
    boost: 8,
    patterns: [
      /\b(code\s*review|review\s+(this\s+)?(pr|diff|change)|lgtm)\b/i,
      /review\s+this\s+refactor/i,
    ],
  },
  {
    modeId: 'documentation',
    boost: 7,
    patterns: [
      /\b(document|docs?|readme|write\s+a\s+guide|adr)\b/i,
    ],
  },
  {
    modeId: 'onboarding',
    boost: 7,
    patterns: [
      /\b(onboard|new\s+developer|getting\s+started|learning\s+path)\b/i,
      /how\s+does\s+this\s+project\s+work/i,
    ],
  },
];

export interface ModeRouteResult {
  mode: NeuronMode;
  score: number;
  reason: string;
  alternatives: Array<{ modeId: ModeId; score: number }>;
}

/**
 * Detect user intent → specialized mode (no autonomous agent).
 */
export class ModeRouter {
  route(query: string, explicitModeId?: string): ModeRouteResult {
    if (explicitModeId) {
      const mode = getModeById(explicitModeId);
      if (mode) {
        return {
          mode,
          score: 1,
          reason: `Explicit mode: ${mode.name}`,
          alternatives: [],
        };
      }
    }

    const scores = new Map<ModeId, number>();
    const reasons = new Map<ModeId, string>();

    for (const route of ROUTES) {
      for (const re of route.patterns) {
        if (re.test(query)) {
          const prev = scores.get(route.modeId) ?? 0;
          scores.set(route.modeId, prev + route.boost);
          if (!reasons.has(route.modeId)) {
            reasons.set(route.modeId, `Matched intent pattern for ${route.modeId}`);
          }
        }
      }
    }

    // Cursor slash hints
    const slash = query
      .trim()
      .match(/^\/(architect|review|debug|security|performance|docs|refactor|onboarding)\b/i);
    if (slash) {
      const map: Record<string, ModeId> = {
        architect: 'architect',
        review: 'code_review',
        debug: 'debug',
        security: 'security_review',
        performance: 'performance',
        docs: 'documentation',
        refactor: 'refactoring',
        onboarding: 'onboarding',
      };
      const id = map[slash[1]!.toLowerCase()]!;
      scores.set(id, (scores.get(id) ?? 0) + 20);
      reasons.set(id, `Cursor command ${slash[0]}`);
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) {
      const fallback = getModeById('architect')!;
      return {
        mode: fallback,
        score: 0.3,
        reason: 'No strong intent — defaulting to Architect Mode for design guidance',
        alternatives: listModes()
          .filter((m) => m.id !== 'architect')
          .slice(0, 3)
          .map((m) => ({ modeId: m.id, score: 0 })),
      };
    }

    const [topId, topScore] = ranked[0]!;
    const mode = getModeById(topId)!;
    const maxBoost = 20;
    return {
      mode,
      score: Math.min(1, topScore / (maxBoost + 10)),
      reason: reasons.get(topId) ?? 'Intent matched',
      alternatives: ranked.slice(1, 4).map(([modeId, score]) => ({
        modeId,
        score: Math.min(1, score / (maxBoost + 10)),
      })),
    };
  }
}

export function createModeRouter(): ModeRouter {
  return new ModeRouter();
}
