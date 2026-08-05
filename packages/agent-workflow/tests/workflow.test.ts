import { describe, expect, it } from 'vitest';

import {
  CodeChangeAnalyzer,
  createAgentWorkflow,
  createEventBus,
  createMemorySuggestionEngine,
  createMemoryQualityChecker,
  DomainEvents,
  defaultWorkflowRules,
  createWorkflowRulesEngine,
} from '../src/index.js';

const authDiff = `
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 111..222 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,3 +1,5 @@
+export function login() {}
diff --git a/src/auth/session.ts b/src/auth/session.ts
new file mode 100644
--- /dev/null
+++ b/src/auth/session.ts
@@ -0,0 +1,2 @@
+export const session = true
diff --git a/src/auth/rbac.ts b/src/auth/rbac.ts
--- a/src/auth/rbac.ts
+++ b/src/auth/rbac.ts
@@ -1 +1,2 @@
+// rbac rewrite
diff --git a/src/auth/tokens.ts b/src/auth/tokens.ts
--- a/src/auth/tokens.ts
+++ b/src/auth/tokens.ts
@@ -1 +1,2 @@
+jwt
diff --git a/src/auth/middleware.ts b/src/auth/middleware.ts
--- a/src/auth/middleware.ts
+++ b/src/auth/middleware.ts
@@ -1 +1,2 @@
+guard
diff --git a/src/auth/permissions.ts b/src/auth/permissions.ts
--- a/src/auth/permissions.ts
+++ b/src/auth/permissions.ts
@@ -1 +1,2 @@
+acl
`;

describe('CodeChangeAnalyzer', () => {
  const analyzer = new CodeChangeAnalyzer();

  it('detects auth architecture changes', () => {
    const analysis = analyzer.analyze({
      diff: authDiff,
      message: 'refactor auth flow',
    });
    expect(analysis.hasAuthChange).toBe(true);
    expect(analysis.summary).toMatch(/Authentication/i);
    expect(analysis.impact).toBe('high');
  });

  it('detects dependency changes', () => {
    const analysis = analyzer.analyze({
      files: ['package.json', 'pnpm-lock.yaml'],
      diff: '+  "redis": "^4.0.0"',
    });
    expect(analysis.hasDependencyChange).toBe(true);
    expect(analysis.changeKind).toBe('dependency');
  });

  it('detects schema migrations', () => {
    const analysis = analyzer.analyze({
      files: ['drizzle/0003_users.sql', 'src/db/schema.ts'],
      message: 'migration: add users table',
    });
    expect(analysis.hasSchemaChange).toBe(true);
    expect(analysis.changeKind).toBe('schema');
  });
});

describe('WorkflowRules + MemorySuggestionEngine', () => {
  it('scores refactor commits highly', () => {
    const analyzer = new CodeChangeAnalyzer();
    const analysis = analyzer.analyze({
      files: ['src/cache/redis.ts', 'src/cache/local.ts', 'src/app.ts'],
      message: 'Replace Redis cache with local cache — architecture rewrite',
    });
    const suggestion = createMemorySuggestionEngine().suggest({
      analysis,
      commitMessage: 'Replace Redis cache with local cache — architecture rewrite',
    });
    expect(suggestion.shouldSuggest).toBe(true);
    expect(suggestion.type).toBe('architecture_decision');
    expect(suggestion.confidence).toBeGreaterThan(0.55);
    expect(suggestion.ruleHits.some((h) => h.ruleId === 'commit-keywords')).toBe(true);
  });

  it('always suggests on schema migration (rule 4)', () => {
    const analysis = new CodeChangeAnalyzer().analyze({
      files: ['migrations/2024_add_orders.sql'],
      message: 'add orders table',
    });
    const hits = createWorkflowRulesEngine(defaultWorkflowRules).evaluate({
      analysis,
      commitMessage: 'add orders table',
    });
    expect(hits.some((h) => h.ruleId === 'schema-migration')).toBe(true);
    const suggestion = createMemorySuggestionEngine().suggest({ analysis });
    expect(suggestion.shouldSuggest).toBe(true);
  });

  it('suggests dependency decisions', () => {
    const analysis = new CodeChangeAnalyzer().analyze({
      files: ['package.json'],
      message: 'add zod',
    });
    const suggestion = createMemorySuggestionEngine().suggest({
      analysis,
      commitMessage: 'add zod',
    });
    expect(suggestion.shouldSuggest).toBe(true);
    expect(suggestion.type).toBe('dependency');
  });

  it('suggests when >5 files in one module', () => {
    const files = Array.from({ length: 7 }, (_, i) => `src/auth/file${i}.ts`);
    const analysis = new CodeChangeAnalyzer().analyze({ files, message: 'auth updates' });
    const suggestion = createMemorySuggestionEngine().suggest({ analysis });
    expect(suggestion.shouldSuggest).toBe(true);
    expect(suggestion.ruleHits.some((h) => h.ruleId === 'module-blast-radius')).toBe(true);
  });
});

describe('MemoryQualityChecker', () => {
  it('rejects near-duplicates', () => {
    const checker = createMemoryQualityChecker();
    const result = checker.check({
      title: 'Use local cache',
      content: 'Replace Redis cache with local in-process cache for sessions',
      type: 'architecture_decision',
      confidence: 0.9,
      existing: [
        {
          id: '1',
          projectId: 'p',
          type: 'architecture_decision',
          title: 'Use local cache',
          content: 'Replace Redis cache with local in-process cache for sessions',
          importanceScore: 0.9,
          confidenceScore: 0.9,
          freshnessScore: 1,
          source: 'agent',
          status: 'active',
          version: 1,
          tags: [],
          usageCount: 0,
          lastUsedAt: null,
          embeddingId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.recommendation).toBe('reject');
  });
});

describe('AgentWorkflowOrchestrator', () => {
  it('manual privacy suppresses suggestions', async () => {
    const workflow = createAgentWorkflow({
      projectId: 'proj-1',
      privacy: 'manual',
    });
    await workflow.beforeCoding({ task: 'refactor auth' });
    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });
    expect(result.suggestion).toBeNull();
    expect(result.promptText).toBeNull();
  });

  it('suggest mode returns a user prompt', async () => {
    const bus = createEventBus();
    const workflow = createAgentWorkflow({
      projectId: 'proj-1',
      privacy: 'suggest',
      eventBus: bus,
    });
    await workflow.beforeCoding({ task: 'refactor auth' });
    await workflow.ingest(
      DomainEvents.codeChanged('proj-1', { diff: authDiff }, 'agent'),
    );
    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });
    expect(result.suggestion?.shouldSuggest).toBe(true);
    expect(result.promptText).toMatch(/Save \| Edit \| Ignore/);
    expect(bus.history().some((e) => e.type === 'AgentStartedTask')).toBe(true);
    expect(bus.history().some((e) => e.type === 'TaskCompleted')).toBe(true);
  });
});
