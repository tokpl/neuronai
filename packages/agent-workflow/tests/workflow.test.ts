import { describe, expect, it } from 'vitest';

import {
  CodeChangeAnalyzer,
  createAgentWorkflow,
  createMemorySuggestionEngine,
  createMemoryQualityChecker,
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
      message: 'Replace Redis cache with local cache - architecture rewrite',
    });
    const suggestion = createMemorySuggestionEngine().suggest({
      analysis,
      commitMessage: 'Replace Redis cache with local cache - architecture rewrite',
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

  it('synthesizes durable architecture prose instead of a changelog', () => {
    const analysis = new CodeChangeAnalyzer().analyze({
      files: [
        'apps/builder/src/WorkflowDraftGraphService.ts',
        'apps/builder/src/Builder/WorkflowBuilderShell.vue',
        'apps/builder/src/EditCanvas.vue',
      ],
      message:
        'Migrate Workflow Builder to WorkflowDraftGraphService + Vue Flow; replace WorkflowDagEditor',
    });
    const suggestion = createMemorySuggestionEngine().suggest({
      analysis,
      commitMessage:
        'Migrate Workflow Builder to WorkflowDraftGraphService + Vue Flow; replace WorkflowDagEditor',
      task: 'migrate workflow builder graph model',
    });

    expect(suggestion.shouldSuggest).toBe(true);
    expect(suggestion.type).toBe('architecture_decision');
    expect(suggestion.sectionHeading).toBe('🧠 Architecture decision to remember');
    expect(suggestion.draftContent).toMatch(/WorkflowDraftGraphService/i);
    expect(suggestion.draftContent).toMatch(/Why:/i);
    expect(suggestion.draftContent).toMatch(/Replaces:/i);
    expect(suggestion.draftContent).not.toMatch(/Impact:/i);
    expect(suggestion.draftContent).not.toMatch(/files:\s*\d+/i);
    expect(suggestion.prompt.askQuestion!.title).toBe('🧠 Project Brain');
    expect(suggestion.prompt.askQuestion!.prompt).toContain(suggestion.draftContent);
    expect(suggestion.prompt.askQuestion!.prompt.startsWith('🧠')).toBe(true);
    expect(
      suggestion.prompt.askQuestion!.prompt.indexOf(suggestion.draftContent),
    ).toBeLessThan(
      suggestion.prompt.askQuestion!.prompt.indexOf(
        'Should I remember this architecture decision for the project?',
      ),
    );
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
    const workflow = createAgentWorkflow({ projectId: 'proj-1', privacy: 'manual' });

    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });

    expect(result.suggestion).toBeNull();
    expect(result.promptText).toBeNull();
  });

  it('suggest mode asks the user before anything is saved', async () => {
    const workflow = createAgentWorkflow({ projectId: 'proj-1', privacy: 'suggest' });

    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });

    expect(result.suggestion?.shouldSuggest).toBe(true);
    expect(result.promptText).toMatch(/🧠 Architecture decision to remember/);
    expect(result.askQuestion?.title).toBe('🧠 Project Brain');
    expect(result.askQuestion?.options.map((o) => o.id)).toEqual(['save', 'edit', 'ignore']);
    // No engine was supplied, so nothing could have been written.
    expect(result.persisted).toBeNull();
  });

  it('exposes the proposed durable memory before the confirmation question', async () => {
    const workflow = createAgentWorkflow({ projectId: 'proj-1', privacy: 'suggest' });

    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
      task: 'migrate auth to modular session + RBAC',
    });

    expect(result.suggestion?.shouldSuggest).toBe(true);
    const draft = result.suggestion!.draftContent;
    const prompt = result.askQuestion!.prompt;
    const text = result.promptText!;

    // Proposed memory must be present in the confirmation UX.
    expect(prompt).toContain(draft);
    expect(text).toContain(draft);
    expect(prompt.startsWith('🧠')).toBe(true);

    // And it must appear *before* asking for confirmation.
    const confirmRe = /Should I remember this architecture decision for the project\?/;
    expect(prompt).toMatch(confirmRe);
    expect(prompt.indexOf(draft)).toBeLessThan(prompt.search(confirmRe));
    expect(text.indexOf(draft)).toBeLessThan(text.search(confirmRe));

    // Section heading precedes the body.
    expect(prompt.indexOf('🧠 Architecture decision to remember')).toBeLessThan(
      prompt.indexOf(draft),
    );

    // Options clarify Edit = rewrite proposed memory, not code.
    expect(result.askQuestion!.options).toEqual([
      { id: 'save', label: 'Yes — save this' },
      { id: 'edit', label: 'Edit — change the proposed memory' },
      { id: 'ignore', label: "No — don't save it" },
    ]);

    // Durable prose — not a changelog / file dump.
    expect(draft).not.toMatch(/Impact:\s/i);
    expect(draft).not.toMatch(/files:\s*\d+/i);
    expect(draft).not.toMatch(/^Signals:/m);
    expect(draft).not.toMatch(/^Task:/m);
    expect(draft).toMatch(/Why:/i);
    expect(draft.length).toBeLessThan(800);
  });

  it('does not manufacture a remember prompt for trivial changes', async () => {
    const workflow = createAgentWorkflow({ projectId: 'proj-1', privacy: 'suggest' });

    const result = await workflow.afterCoding({
      files: ['README.md'],
      commitMessage: 'docs: fix typo',
      summary: 'typo',
    });

    expect(result.suggestion).toBeNull();
    expect(result.askQuestion).toBeNull();
    expect(result.promptText).toBeNull();
  });

  it('does not re-suggest knowledge the project already has', async () => {
    const workflow = createAgentWorkflow({
      projectId: 'proj-1',
      privacy: 'suggest',
      listExistingMemories: async () => {
        const draft = await createAgentWorkflow({
          projectId: 'proj-1',
          privacy: 'suggest',
        }).afterCoding({ diff: authDiff, commitMessage: 'refactor authentication architecture' });
        return [
          {
            id: 'existing',
            projectId: 'proj-1',
            type: draft.suggestion!.type,
            title: draft.suggestion!.title,
            content: draft.suggestion!.draftContent,
            status: 'active',
            importanceScore: 0.8,
            confidenceScore: 0.8,
            freshnessScore: 1,
            source: 'agent',
            tags: [],
            version: 1,
            usageCount: 0,
            lastUsedAt: null,
            embeddingId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      },
    });

    const result = await workflow.afterCoding({
      diff: authDiff,
      commitMessage: 'refactor authentication architecture',
    });

    expect(result.suggestion).toBeNull();
    expect(result.quality?.recommendation).toBe('reject');
  });
});
