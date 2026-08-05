import { describe, expect, it } from 'vitest';

import {
  createDatabasePerformanceAnalyzer,
  createFrontendPerformanceAnalyzer,
  createPerformanceIntelligence,
  createScalabilityAnalyzer,
} from '../src/index.js';

describe('database analysis', () => {
  it('flags relation loads without eager include as HIGH', () => {
    const findings = createDatabasePerformanceAnalyzer().analyze({
      snippets: [
        `
        const users = await prisma.user.findMany();
        for (const u of users) {
          const posts = await prisma.post.findMany({ where: { userId: u.id } });
        }
        `,
      ],
    });
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
    expect(findings.some((f) => /eager loading/i.test(f.recommendation))).toBe(true);
  });
});

describe('frontend analysis', () => {
  it('detects React list render risks', () => {
    const findings = createFrontendPerformanceAnalyzer().analyze({
      snippets: [
        `import { useState } from 'react';
         export function List({ items }) {
           const [x, setX] = useState(0);
           return items.map((i) => <Row key={i.id} item={i} />);
         }`,
      ],
      filePaths: ['src/components/List.tsx'],
    });
    expect(findings.some((f) => f.type === 'FRONTEND')).toBe(true);
  });
});

describe('performance memory', () => {
  it('stores and retrieves performance memories', () => {
    const intel = createPerformanceIntelligence();
    const mem = intel.remember({
      type: 'DATABASE',
      description: 'Slow checkout N+1',
      impact: 'Checkout latency spikes',
      severity: 'HIGH',
      affectedModules: ['Payment'],
      recommendation: 'Use eager loading',
    });
    expect(intel.performanceHistory('checkout')[0]!.id).toBe(mem.id);
    intel.resolveMemory(mem.id, 'Added include: { items: true }');
    expect(intel.listMemories()[0]!.status).toBe('OPTIMIZED');
  });
});

describe('scalability / regression-style coupling', () => {
  it('warns when Payment depends directly on Notification', () => {
    const warnings = createScalabilityAnalyzer().analyze({
      modules: ['Payment', 'Notification'],
      dependencies: [{ from: 'Payment', to: 'Notification' }],
    });
    expect(warnings.some((w) => /event communication/i.test(w.recommendation))).toBe(true);
    expect(warnings[0]!.severity).toBe('HIGH');
  });
});
