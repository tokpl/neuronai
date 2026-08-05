import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createAiRuntime,
  createContextClassifier,
  createOfflineProvider,
  createPrivacyRouter,
  DEFAULT_AI_CONFIG,
} from '../src/index.js';

const temps: string[] = [];

afterEach(async () => {
  for (const d of temps.splice(0)) {
    await rm(d, { recursive: true, force: true });
  }
});

describe('providers', () => {
  it('offline provider implements full contract without network', async () => {
    const p = createOfflineProvider();
    const gen = await p.generate('hello architecture');
    expect(gen.offline).toBe(true);
    expect(gen.text).toContain('offline');
    const emb = await p.embed(['a', 'b']);
    expect(emb.vectors).toHaveLength(2);
    expect(emb.contentHashes).toHaveLength(2);
    const health = await p.health();
    expect(health.ok).toBe(true);
  });
});

describe('routing', () => {
  it('selects small local model for summarization when cloud blocked', async () => {
    const rt = createAiRuntime();
    await rt.load(await mkdtemp(join(tmpdir(), 'neuron-ai-')));
    rt.setConfig({ ...DEFAULT_AI_CONFIG, allowCloud: false, mode: 'hybrid' });
    const sel = rt.selectModel('SUMMARIZATION', 'short note');
    expect(sel.model.local).toBe(true);
    expect(sel.privacy.cloudBlocked).toBe(true);
  });

  it('architecture reasoning prefers large tier when cloud allowed', async () => {
    const rt = createAiRuntime();
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ai-'));
    temps.push(dir);
    await rt.load(dir);
    rt.setConfig({ allowCloud: true, mode: 'hybrid', preferredProvider: 'anthropic' });
    const sel = rt.selectModel('ARCHITECTURE_REASONING', 'Should we split the monolith?');
    expect(sel.profile.kind).toBe('ARCHITECTURE_REASONING');
    expect(sel.model.tier === 'large' || sel.providerId === 'anthropic').toBe(true);
  });
});

describe('privacy', () => {
  it('classifies README as PUBLIC and .env as CRITICAL', () => {
    const c = createContextClassifier();
    expect(c.classify('README.md')).toBe('PUBLIC');
    expect(c.classify('.env')).toBe('CRITICAL');
  });

  it('blocks cloud for secrets', () => {
    const privacy = createPrivacyRouter();
    const result = privacy.check({
      text: 'api_key=sk-abc123secret',
      pathHint: 'src/config.ts',
      config: { ...DEFAULT_AI_CONFIG, allowCloud: true, mode: 'hybrid' },
    });
    expect(result.containsSecrets).toBe(true);
    expect(result.recommendedRoute).toBe('local');
  });

  it('privacyCheck via runtime', async () => {
    const rt = createAiRuntime();
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ai-'));
    temps.push(dir);
    await rt.load(dir);
    const check = rt.privacyCheck('password=hunter2', '.env.local');
    expect(check.classification).toBe('CRITICAL');
    expect(check.recommendedRoute === 'local' || check.recommendedRoute === 'offline').toBe(
      true,
    );
  });
});

describe('offline', () => {
  it('offline mode keeps scanning capabilities without cloud', async () => {
    const rt = createAiRuntime();
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ai-'));
    temps.push(dir);
    await rt.load(dir);
    rt.setConfig({ mode: 'offline', allowCloud: false });
    const status = await rt.status();
    expect(status.offline.projectScanning).toBe(true);
    expect(status.offline.memoryRetrieval).toBe(true);
    expect(status.offline.cloudModels).toBe(false);
  });

  it('persists .neuron/ai.json', async () => {
    const rt = createAiRuntime();
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ai-'));
    temps.push(dir);
    await rt.load(dir);
    rt.setConfig({ mode: 'hybrid', allowCloud: false, preferredProvider: 'ollama' });
    rt.recordPerformance({
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      task: 'ARCHITECTURE_REASONING',
      quality: 0.95,
      latencyMs: 1200,
    });
    const paths = await rt.save(dir);
    expect(paths.aiJson).toContain('ai.json');

    const rt2 = createAiRuntime();
    await rt2.load(dir);
    expect(rt2.getConfig().preferredProvider).toBe('ollama');
    expect(rt2.getConfig().allowCloud).toBe(false);
    const best = rt2.selectModel('ARCHITECTURE_REASONING');
    expect(best.reason).toMatch(/performance memory|tier|Task/i);
  });
});

describe('hybrid', () => {
  it('runs local hybrid without cloud consent', async () => {
    const rt = createAiRuntime();
    const dir = await mkdtemp(join(tmpdir(), 'neuron-ai-'));
    temps.push(dir);
    await rt.load(dir);
    rt.setConfig({ allowCloud: false, mode: 'hybrid' });
    const result = await rt.hybrid().run({
      task: 'CODE_ANALYSIS',
      prompt: 'Parse the module graph',
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.selectionReason).toMatch(/local|tier|Task/i);
  });
});
