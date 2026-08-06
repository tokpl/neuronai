import { describe, expect, it } from 'vitest';

import {
  createBrainCompiler,
  estimateTokens,
  resolvePreparationMode,
} from '../src/index.js';

describe('BrainCompiler', () => {
  const compiler = createBrainCompiler();

  const fatDecisions = Array.from({ length: 12 }, (_, i) => ({
    id: `d${i}`,
    kind: 'decision' as const,
    title: `Decision ${i}: ProjectBrain owns runtime state ${i}`,
    content: `Decision: Always route component ${i} through ProjectBrain. Never bypass. Extra prose ${'x'.repeat(80)}`,
    score: 1 - i * 0.05,
  }));

  it('defaults to minimal and stays under token budget', () => {
    const prep = resolvePreparationMode(undefined);
    expect(prep.mode).toBe('minimal');
    expect(prep.tokenBudget).toBe(500);

    const compiled = compiler.compile({
      task: 'Add a CLI flag',
      modules: ['cli', 'brain', 'mcp'],
      architectureNotes: ['ProjectBrain is SoT', 'Runtime cache is disposable'],
      decisions: fatDecisions,
      patterns: fatDecisions.map((d) => ({ ...d, id: `p${d.id}`, kind: 'pattern' as const })),
      warnings: ['Do not store raw chat transcripts'],
      planSteps: ['Should not appear in minimal'],
      risks: ['Should not appear in minimal'],
    });

    expect(compiled.mode).toBe('minimal');
    expect(compiled.metrics.promptTokens).toBeLessThanOrEqual(compiled.metrics.tokenBudget);
    expect(compiled.prompt).toMatch(/^# Task/m);
    expect(compiled.prompt).toMatch(/Architecture decisions/);
    expect(compiled.prompt).not.toMatch(/Approach|# Risks/i);
    expect(compiled.prompt).not.toMatch(/graphDistance|rankingScore|freshness|0\.\d{2}/);
    expect(compiled.prompt).not.toMatch(/d0|components/);
    expect(compiled.debug).toBeUndefined();
    expect(compiled.metrics.knowledgeSearched).toBeGreaterThan(compiled.metrics.knowledgeSelected);
    expect(compiled.metrics.kindNotes.promptTokens).toBe('measured');
  });

  it('standard adds hints but not plans', () => {
    const compiled = compiler.compile({
      task: 'Wire MCP handler',
      mode: 'standard',
      decisions: fatDecisions.slice(0, 3),
      hints: ['Prefer public APIs in packages/*/src/index.ts'],
      planSteps: ['Plan step must stay out'],
      risks: ['Risk must stay out'],
    });
    expect(compiled.mode).toBe('standard');
    expect(compiled.prompt).toMatch(/Implementation hints/);
    expect(compiled.prompt).not.toMatch(/^# Approach/m);
    expect(compiled.prompt).not.toMatch(/^# Risks/m);
    expect(estimateTokens(compiled.prompt)).toBeLessThanOrEqual(1200);
  });

  it('deep includes approach and risks', () => {
    const compiled = compiler.compile({
      task: 'Migrate storage to ProjectBrain',
      mode: 'deep',
      decisions: fatDecisions.slice(0, 2),
      planSteps: ['Migrate legacy files', 'Delete after success'],
      risks: ['HIGH: dual-write window'],
    });
    expect(compiled.mode).toBe('deep');
    expect(compiled.prompt).toMatch(/Approach/);
    expect(compiled.prompt).toMatch(/Risks/);
    expect(compiled.metrics.promptTokens).toBeLessThanOrEqual(3500);
  });

  it('debug attaches raw dump without putting scores in prompt', () => {
    const compiled = compiler.compile({
      task: 'Debug compression',
      mode: 'debug',
      decisions: fatDecisions.slice(0, 2),
    });
    expect(compiled.debug?.rawDump).toMatch(/"score"/);
    expect(compiled.prompt).not.toMatch(/"score"/);
  });

  it('explains inclusions and exclusions', () => {
    const compiled = compiler.compile({
      task: 'Tiny budget packing',
      mode: 'minimal',
      decisions: fatDecisions,
    });
    const why = compiler.explainInclusion(compiled, fatDecisions[0]!.title);
    expect(why).toMatch(/Included|Excluded/);
  });
});
