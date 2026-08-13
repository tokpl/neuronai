import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMcpRuntime, type McpRuntime } from '../src/config/runtime.js';
import { handleAfterTask } from '../src/handlers/after-task.js';
import { handleContext } from '../src/handlers/context.js';
import { handleRemember } from '../src/handlers/remember.js';
import { handleResolveSuggestion } from '../src/handlers/resolve-suggestion.js';
import { handleSearch } from '../src/handlers/search.js';
import { TOOL_NAMES } from '../src/tools/register-tools.js';

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

function body(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

async function newRuntime(): Promise<McpRuntime> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-mcp-'));
  temps.push(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo-app' }), 'utf8');
  return createMcpRuntime(root);
}

async function seed(runtime: McpRuntime): Promise<void> {
  await handleRemember(runtime, {
    type: 'architecture_decision',
    title: 'Rate limiting belongs in MCP middleware',
    content:
      'Apply rate limiting once in the MCP server middleware so every tool handler inherits it.',
  });
  await handleRemember(runtime, {
    type: 'architecture_decision',
    title: 'AGPL-3.0 licensing for first-party NeuronAI',
    content: 'The project ships under AGPL-3.0 with a separate trademark policy.',
  });
}

describe('MCP tool surface', () => {
  it('exposes exactly seven tools', () => {
    expect(TOOL_NAMES).toHaveLength(7);
    expect([...TOOL_NAMES]).toEqual([
      'neuron_context',
      'neuron_search',
      'neuron_remember',
      'neuron_update',
      'neuron_after_task',
      'neuron_resolve_suggestion',
      'neuron_scan',
    ]);
  });
});

describe('neuron_context', () => {
  it('returns one canonical context field, not several copies', async () => {
    const runtime = await newRuntime();
    await seed(runtime);

    const result = body(
      await handleContext(runtime, { task: 'add rate limiting to MCP handlers' }),
    );

    expect(Object.keys(result).sort()).toEqual([
      'afterCoding',
      'context',
      'contribution',
      'intent',
      'metrics',
      'mode',
      'ok',
      'present',
      'relevantFiles',
      'relevantModules',
      'relevantRules',
    ]);
    expect(result['briefing']).toBeUndefined();
    expect(result['markdown']).toBeUndefined();
    expect(result['decisions']).toBeUndefined();
    expect(result['recommendations']).toBeUndefined();
    const afterCoding = result['afterCoding'] as { required: boolean; tool: string };
    expect(afterCoding.required).toBe(true);
    expect(afterCoding.tool).toBe('neuron_after_task');
    const contribution = result['contribution'] as {
      summary: string;
      label: string;
      brainCompressionTokens: number;
    };
    expect(contribution.label).toBe('brain-compression');
    expect(contribution.summary).toMatch(/^🌱 Neuron ·/);
    expect(contribution.summary).toMatch(/saved ~/);
    expect(contribution.summary).toMatch(/Used \d+ memor/);
    expect(contribution.summary).toMatch(/Ranked this context in \d+ ms/);
    expect(contribution.summary).not.toMatch(/skipped/i);
    expect(contribution.brainCompressionTokens).toBeGreaterThanOrEqual(0);
    expect(contribution.memoriesUsed).toBeGreaterThan(0);
    expect(contribution.summary).toMatch(/matched Project Brain knowledge|Packed into|saved ~/);
    const present = result['present'] as { footer: { instruction: string } };
    expect(present.footer.instruction).toMatch(/REQUIRED every time/);
    expect(present.footer.instruction).toMatch(/contribution\.summary/);
  });

  it('mentions each relevant memory once', async () => {
    const runtime = await newRuntime();
    await seed(runtime);

    const result = body(
      await handleContext(runtime, { task: 'add rate limiting to MCP handlers' }),
    );
    const context = String(result['context']);
    const occurrences = context.split('Rate limiting').length - 1;

    expect(occurrences).toBe(1);
  });

  it('excludes irrelevant knowledge and stays inside the budget', async () => {
    const runtime = await newRuntime();
    await seed(runtime);

    const result = body(
      await handleContext(runtime, { task: 'add rate limiting to MCP handlers' }),
    );
    const metrics = result['metrics'] as Record<string, number>;

    expect(String(result['context'])).not.toContain('AGPL');
    expect(metrics['contextTokens']).toBeLessThanOrEqual(500);
    expect(metrics['budgetTokens']).toBe(500);
    expect(metrics['estimatedTokensSaved']).toBeGreaterThanOrEqual(0);
    expect(result['mode']).toBe('minimal');
  });

  it('does not leak ids or ranking scores into the context', async () => {
    const runtime = await newRuntime();
    await seed(runtime);

    const context = String(
      body(await handleContext(runtime, { task: 'rate limiting' }))['context'],
    );

    expect(context).not.toMatch(/importanceScore|taskRelevance|graphDistance/);
    expect(context).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('neuron_search', () => {
  it('returns only memories that match the query', async () => {
    const runtime = await newRuntime();
    await seed(runtime);

    const result = body(await handleSearch(runtime, { query: 'rate limiting middleware' }));
    const results = result['results'] as Array<{ title: string; why: string }>;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain('Rate limiting');
    expect(results.map((r) => r.title).join(' ')).not.toContain('AGPL');
    expect(results[0]?.why).toBeTruthy();
  });
});

describe('neuron_remember', () => {
  it('merges instead of duplicating known knowledge', async () => {
    const runtime = await newRuntime();
    await handleRemember(runtime, {
      type: 'architecture_decision',
      title: 'Use RBAC with hierarchy',
      content: 'Problem: scalable permissions. Decision: RBAC with a role hierarchy.',
    });

    const second = body(
      await handleRemember(runtime, {
        type: 'architecture_decision',
        title: 'Use RBAC with hierarchy',
        content: 'Decision: RBAC, with a hierarchy.',
      }),
    );

    expect(second['status']).toBe('merged');
    expect(runtime.neuron.brain.knowledge.decisions).toHaveLength(1);
  });
});

describe('ask before remembering', () => {
  const authDiff = [
    'diff --git a/src/auth/login.ts b/src/auth/login.ts',
    '--- a/src/auth/login.ts',
    '+++ b/src/auth/login.ts',
    '+export function login() {}',
    'diff --git a/src/auth/session.ts b/src/auth/session.ts',
    '--- /dev/null',
    '+++ b/src/auth/session.ts',
    '+export function session() {}',
  ].join('\n');

  it('proposes without writing, then writes only after the user answers', async () => {
    const runtime = await newRuntime();

    const proposal = body(
      await handleAfterTask(runtime, {
        task: 'refactor auth',
        diff: authDiff,
        commitMessage: 'refactor authentication architecture',
      }),
    );

    expect(proposal['suggest']).toBe(true);
    expect(proposal['question']).toBeTruthy();
    const question = proposal['question'] as {
      title: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
    };
    expect(question.title).toBe('🧠 Project Brain');
    expect(question.prompt).toMatch(/^🧠 Architecture decision to remember/);
    expect(question.prompt).toContain(
      'Should I remember this architecture decision for the project?',
    );
    expect(question.prompt.indexOf('refactor authentication architecture')).toBeLessThan(
      question.prompt.indexOf('Should I remember this architecture decision'),
    );
    expect(question.options.map((o) => o.id)).toEqual(['save', 'edit', 'ignore']);
    const present = proposal['present'] as { prefer: string; instruction: string };
    expect(present.prefer).toBe('AskQuestion');
    expect(present.instruction).toMatch(/AskQuestion/);
    expect(present.instruction).toMatch(/contribution\.summary/);
    // Nothing stored yet.
    expect(runtime.neuron.listMemories()).toHaveLength(0);
    expect(proposal['persisted']).toBeNull();

    const saved = body(await handleResolveSuggestion(runtime, { action: 'save' }));
    expect(saved['status']).toBe('stored');
    expect(runtime.neuron.listMemories()).toHaveLength(1);
    expect(runtime.pendingSuggestion).toBeNull();
  });

  it('autosaves in automatic privacy without AskQuestion but keeps a notice present', async () => {
    const prev = process.env['NEURON_PRIVACY_MODE'];
    process.env['NEURON_PRIVACY_MODE'] = 'automatic';
    try {
      const runtime = await newRuntime();
      const proposal = body(
        await handleAfterTask(runtime, {
          task: 'refactor auth',
          diff: authDiff,
          commitMessage: 'refactor authentication architecture',
        }),
      );

      expect(proposal['suggest']).toBe(true);
      expect(proposal['persisted']).toEqual(expect.objectContaining({ id: expect.any(String) }));
      expect(proposal['question']).toBeNull();
      const present = proposal['present'] as { prefer: string; instruction: string };
      expect(present.prefer).toBe('notice');
      expect(present.instruction).toMatch(/already saved/i);
      expect(present.instruction).toMatch(/contribution\.summary/);
      expect(present.instruction).toMatch(/Do NOT call AskQuestion/i);
      expect(runtime.pendingSuggestion).toBeNull();
      expect(runtime.neuron.listMemories().length).toBeGreaterThanOrEqual(1);
    } finally {
      if (prev === undefined) delete process.env['NEURON_PRIVACY_MODE'];
      else process.env['NEURON_PRIVACY_MODE'] = prev;
    }
  });

  it('writes nothing when the user declines', async () => {
    const runtime = await newRuntime();
    await handleAfterTask(runtime, {
      task: 'refactor auth',
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });

    const ignored = body(await handleResolveSuggestion(runtime, { action: 'ignore' }));

    expect(ignored['status']).toBe('ignored');
    expect(runtime.neuron.listMemories()).toHaveLength(0);
  });

  it('stores the user wording on edit', async () => {
    const runtime = await newRuntime();
    await handleAfterTask(runtime, {
      task: 'refactor auth',
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });

    await handleResolveSuggestion(runtime, {
      action: 'edit',
      title: 'Auth lives behind JWT middleware',
      content: 'All authentication runs through JWT middleware, never inline in route handlers.',
    });

    const stored = runtime.neuron.listMemories();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('Auth lives behind JWT middleware');
  });

  it('fails clearly when there is nothing to resolve', async () => {
    const runtime = await newRuntime();
    const result = body(await handleResolveSuggestion(runtime, { action: 'save' }));

    expect(result['ok']).toBe(false);
    expect(JSON.stringify(result)).toMatch(/No pending suggestion/);
  });
});
