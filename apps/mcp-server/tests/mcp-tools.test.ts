import { describe, expect, it } from 'vitest';

import { createNeuronRuntime } from '../src/config/runtime.js';
import { createNeuronMcpServer } from '../src/server/create-server.js';
import {
  handleAfterTask,
  handleGetContext,
  handlePrepareTask,
  handleResolveSuggestion,
  handleReviewMemory,
  handleSaveDecision,
  handleSearchMemory,
  handleStoreMemory,
  handleUpdateMemory,
  handleProjectSummary,
} from '../src/handlers/index.js';
import { LocalAuthProvider, ApiKeyAuthProvider } from '../src/middleware/auth.js';
import { getHealth } from '../src/health.js';
import { MVP_TOOL_NAMES } from '../src/tools/register-tools.js';

describe('mcp health', () => {
  it('reports ok', () => {
    expect(getHealth('local').status).toBe('ok');
  });
});

describe('auth providers', () => {
  it('allows local mode without key', () => {
    const auth = new LocalAuthProvider();
    expect(auth.assertAuthorized().authenticated).toBe(true);
  });

  it('rejects bad api keys in cloud mode', () => {
    const auth = new ApiKeyAuthProvider('secret');
    expect(() => auth.assertAuthorized('nope')).toThrow(/API key/);
  });
});

describe('mvp tool set', () => {
  it('exposes exactly 13 tools', () => {
    expect(MVP_TOOL_NAMES).toHaveLength(13);
  });
});

describe('mcp tool handlers', () => {
  it('registers tools on the server', async () => {
    const runtime = await createNeuronRuntime(process.cwd());
    const server = createNeuronMcpServer(runtime);
    expect(server).toBeDefined();
  });

  it('saves decisions, searches, updates, and reviews', async () => {
    const runtime = await createNeuronRuntime(process.cwd());

    const saved = await handleSaveDecision(runtime, {
      title: 'Use RBAC',
      problem: 'Need scalable permissions',
      decision: 'Use RBAC',
      reason: 'Easier role management',
      alternatives: ['Hardcoded permissions', 'ACL'],
    });
    expect(saved.isError).toBeFalsy();
    const savedBody = JSON.parse(saved.content[0]!.text) as {
      ok: boolean;
      memory: { id: string };
    };
    expect(savedBody.ok).toBe(true);

    const context = await handleGetContext(runtime, {
      task: 'Add permission checks to vehicles',
    });
    expect(context.isError).toBeFalsy();

    const search = await handleSearchMemory(runtime, {
      query: 'RBAC permissions',
      limit: 5,
    });
    expect(search.isError).toBeFalsy();

    const updated = await handleUpdateMemory(runtime, {
      id: savedBody.memory.id,
      content:
        'Problem: Need scalable permissions\nDecision: Use RBAC with hierarchy\nReason: Easier role management',
      reason: 'Clarify role hierarchy',
    });
    expect(updated.isError).toBeFalsy();

    const review = await handleReviewMemory(runtime, {
      text: 'We always wrap API responses in a standard envelope.',
    });
    const reviewBody = JSON.parse(review.content[0]!.text) as {
      shouldSave: boolean;
      suggestedType: string | null;
    };
    expect(reviewBody.shouldSave).toBe(true);
    expect(reviewBody.suggestedType).toBeTruthy();

    const stored = await handleStoreMemory(runtime, {
      type: 'mistake',
      title: 'Do not bypass permission service',
      content: 'Bypassing permission service caused auth bugs in the past.',
    });
    expect(stored.isError).toBeFalsy();

    const summary = await handleProjectSummary(runtime, {});
    expect(summary.isError).toBeFalsy();
  });

  it('runs after task workflow suggestions', async () => {
    const runtime = await createNeuronRuntime(process.cwd());
    expect(runtime.workflow).toBeDefined();
    expect(runtime.privacyMode).toBeTruthy();

    const after = await handleAfterTask(runtime, {
      task: 'Replace Redis cache with local cache',
      commitMessage: 'refactor: replace Redis cache with local cache - architecture rewrite',
      files: ['src/cache/redis.ts', 'src/cache/local.ts', 'package.json'],
    });
    expect(after.isError).toBeFalsy();
    const body = JSON.parse(after.content[0]!.text) as {
      ok: boolean;
      pending: boolean;
      howToRespond: string;
      userInstruction: string;
      askQuestion: { options: { id: string; label: string }[] } | null;
      suggestion: { shouldSuggest: boolean; type: string } | null;
    };
    expect(body.ok).toBe(true);
    expect(body.suggestion?.shouldSuggest).toBe(true);
    expect(body.pending).toBe(true);
    expect(body.howToRespond).toMatch(/neuron_resolve_suggestion/);
    expect(body.userInstruction).toMatch(/AskQuestion/i);
    expect(body.askQuestion?.options?.length).toBe(3);
    expect(body.askQuestion?.options?.map((o) => o.label).join(' ')).toMatch(/Yes|Edit|No/i);
    expect(runtime.pendingSuggestion).not.toBeNull();

    const ignored = await handleResolveSuggestion(runtime, { action: 'ignore' });
    expect(ignored.isError).toBeFalsy();
    expect(runtime.pendingSuggestion).toBeNull();
  });

  it('resolves Save after after_task pending suggestion', async () => {
    const runtime = await createNeuronRuntime(process.cwd());
    const unique = `ux-reply-flow-${Date.now()}`;
    await handleAfterTask(runtime, {
      task: `Replace Redis cache with local cache ${unique}`,
      commitMessage: `refactor: ${unique} replace Redis cache - architecture rewrite`,
      files: [
        'src/cache/redis.ts',
        'src/cache/local.ts',
        'package.json',
        'src/auth/session.ts',
        'src/auth/rbac.ts',
        'docs/architecture.md',
      ],
    });
    expect(runtime.pendingSuggestion).not.toBeNull();

    // Keep title unique so repeated test runs do not hit duplicate detection
    runtime.pendingSuggestion = {
      ...runtime.pendingSuggestion!,
      title: unique,
      draftContent: `User-facing remember Yes/No instructions for Cursor chat (${unique}).`,
    };

    const saved = await handleResolveSuggestion(runtime, { action: 'save' });
    expect(saved.isError).toBeFalsy();
    const body = JSON.parse(saved.content[0]!.text) as {
      status: string;
      memory: { title: string };
    };
    expect(body.status).toBe('stored');
    expect(body.memory.title).toBe(unique);
    expect(runtime.pendingSuggestion).toBeNull();
  });

  it('prepares tasks via agent intelligence', async () => {
    const runtime = await createNeuronRuntime(process.cwd());

    const prep = await handlePrepareTask(runtime, {
      task: 'Add vehicle trading system',
      mode: 'standard',
    });
    expect(prep.isError).toBeFalsy();
    const prepBody = JSON.parse(prep.content[0]!.text) as {
      ok: boolean;
      prompt: string;
      briefing: string;
      metrics: { promptTokens: number; mode: string };
      plan?: { steps: unknown[] };
      debug?: unknown;
    };
    expect(prepBody.ok).toBe(true);
    expect(prepBody.prompt.length).toBeGreaterThan(0);
    expect(prepBody.briefing).toBe(prepBody.prompt);
    expect(prepBody.metrics.promptTokens).toBeGreaterThan(0);
    expect(prepBody.plan).toBeUndefined();
    expect(prepBody.debug).toBeUndefined();
    expect(prepBody.prompt).not.toMatch(/graphDistance|rankingScore/);
  });

  it('returns structured errors for invalid update ids', async () => {
    const runtime = await createNeuronRuntime(process.cwd());
    const result = await handleUpdateMemory(runtime, {
      id: '00000000-0000-4000-a000-000000000099',
      content: 'x',
      reason: 'test',
    });
    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0]!.text) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
