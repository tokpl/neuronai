import { describe, expect, it } from 'vitest';

import {
  createDocumentationDriftDetector,
  createDocumentationIntelligence,
  createDocumentationAnalyzer,
  createModuleDocGenerator,
  createDocumentationQualityScorer,
} from '../src/index.js';

describe('doc generation', () => {
  it('generates architecture doc with modules and decisions', () => {
    const intel = createDocumentationIntelligence();
    const arts = intel.generateDocs({
      projectName: 'Shop',
      modules: ['Payment', 'Auth'],
      databases: ['PostgreSQL'],
      decisions: ['Use Stripe Checkout for payments'],
      architectureNotes: ['Modular monolith'],
    });
    const arch = arts.find((a) => a.type === 'ARCHITECTURE_DOC');
    expect(arch?.content).toMatch(/Overview/i);
    expect(arch?.content).toMatch(/Payment/);
    expect(arch?.content).toMatch(/Stripe Checkout/);
    expect(arch?.path).toMatch(/\.neuron\/docs\/architecture\.md/);
  });
});

describe('drift detection', () => {
  it('flags MySQL docs vs PostgreSQL brain', () => {
    const analyzer = createDocumentationAnalyzer();
    const docFacts = analyzer.extractFactsFromMarkdown('Database: MySQL\n', 'README');
    const brainFacts = analyzer.brainFacts({ databases: ['PostgreSQL'] });
    const drift = createDocumentationDriftDetector().detect(docFacts, brainFacts);
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0]!.documented).toMatch(/MySQL/i);
    expect(drift[0]!.actual).toMatch(/PostgreSQL/i);
    expect(drift[0]!.recommendation).toMatch(/Update/i);
  });
});

describe('module docs', () => {
  it('includes purpose, security, decisions sections', () => {
    const doc = createModuleDocGenerator().generate({
      name: 'Payment',
      purpose: 'Handles checkout and refunds',
      responsibilities: ['Charge cards', 'Issue refunds'],
      dependencies: ['Stripe'],
      securityNotes: ['Never log PAN'],
      relatedDecisions: ['ADR-001 Stripe Checkout'],
    });
    expect(doc.content).toMatch(/Purpose/);
    expect(doc.content).toMatch(/Security notes/);
    expect(doc.content).toMatch(/ADR-001/);
  });
});

describe('quality', () => {
  it('scores documentation health out of 100', () => {
    const intel = createDocumentationIntelligence();
    intel.generateDocs({
      projectName: 'Shop',
      modules: ['Payment', 'Auth'],
      decisions: ['Centralize auth'],
    });
    const health = createDocumentationQualityScorer().score({
      artifacts: intel.listArtifacts(),
      drift: [],
      expectedModules: 2,
    });
    expect(health.overall).toBeGreaterThan(50);
    expect(health.overall).toBeLessThanOrEqual(100);
    expect(health.coverage).toBeGreaterThan(0);
  });
});
