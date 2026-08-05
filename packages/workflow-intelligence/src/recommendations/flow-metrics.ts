import type { DeveloperSession, ProjectFlowMetrics, TechnicalTaskMemory } from '../types.js';

/**
 * Project flow metrics only — never people productivity scores.
 */
export class FlowMetricsAnalyzer {
  analyze(input: {
    sessions?: DeveloperSession[];
    tasks?: TechnicalTaskMemory[];
  }): ProjectFlowMetrics {
    const tasks = input.tasks ?? [];
    const sessions = input.sessions ?? [];

    const unfinishedTechnicalAreas = unique([
      ...tasks.filter((t) => t.status === 'IN_PROGRESS' || t.remaining.length > 0).map((t) => t.title),
      ...sessions
        .filter((s) => s.status !== 'closed')
        .flatMap((s) => [s.activeArea, ...s.unfinishedWork]),
    ]);

    const blockedAreas = unique(
      tasks.filter((t) => t.status === 'BLOCKED').map((t) => t.title),
    );

    const freq = new Map<string, number>();
    for (const s of sessions) {
      for (const f of s.relatedFiles) {
        const area = areaFromPath(f) || s.activeArea;
        freq.set(area, (freq.get(area) ?? 0) + 1);
      }
      freq.set(s.activeArea, (freq.get(s.activeArea) ?? 0) + 2);
    }
    const frequentChangeAreas = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);

    return {
      unfinishedTechnicalAreas: unfinishedTechnicalAreas.slice(0, 20),
      blockedAreas,
      frequentChangeAreas,
      note: 'Project flow metrics only — not employee monitoring or time tracking.',
    };
  }
}

function areaFromPath(path: string): string {
  const p = path.replace(/\\/g, '/').toLowerCase();
  if (p.includes('payment')) return 'Payment';
  if (p.includes('auth')) return 'Auth';
  if (p.includes('user')) return 'Users';
  if (p.includes('admin')) return 'Admin';
  return '';
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}

export function createFlowMetricsAnalyzer(): FlowMetricsAnalyzer {
  return new FlowMetricsAnalyzer();
}
