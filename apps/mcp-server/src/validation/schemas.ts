import { z } from 'zod';

/**
 * Input schemas for MCP tools.
 * Every schema here is registered — there is no speculative surface.
 */

const projectId = z.string().min(1).optional();

export const MEMORY_TYPES = [
  'architecture_decision',
  'knowledge',
  'pattern',
  'mistake',
  'business_rule',
  'dependency',
  'context',
] as const;

export const contextSchema = {
  task: z.string().min(1).describe('What the developer is about to do'),
  mode: z.enum(['minimal', 'standard', 'deep']).optional(),
  files: z.array(z.string()).optional(),
  projectId,
};

export const searchSchema = {
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
  projectId,
};

export const rememberSchema = {
  type: z.enum(MEMORY_TYPES),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
  projectId,
};

export const updateSchema = {
  id: z.string().min(1),
  reason: z.string().min(1).describe('Why this changed — stored as a version note'),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  projectId,
};

export const afterTaskSchema = {
  task: z.string().optional(),
  summary: z.string().optional(),
  diff: z.string().optional(),
  files: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
  projectId,
};

export const resolveSuggestionSchema = {
  action: z.enum(['save', 'edit', 'ignore']),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(MEMORY_TYPES).optional(),
  projectId,
};

export const scanSchema = {
  mode: z.enum(['fast', 'deep', 'architecture', 'update']).optional(),
};

export const resolveClarifySchema = {
  questionId: z.string().min(1),
  optionId: z.string().min(1).optional(),
  freeText: z.string().min(1).optional(),
  questionPrompt: z.string().optional(),
  task: z.string().optional(),
  projectId,
};

export const workflowSchema = {
  action: z.enum([
    'get_board',
    'set_board',
    'clear_board',
    'propose_waves',
    'complete_checklist',
  ]),
  seedPath: z.string().optional(),
  playbook: z.enum(['build', 'ui', 'docs', 'polish', 'maintain']).optional(),
  checklistDone: z.array(z.string()).optional(),
  checklistNotes: z.record(z.string()).optional(),
  board: z
    .object({
      goal: z.string().optional(),
      phase: z
        .enum([
          'clarify',
          'blueprint',
          'decompose',
          'execute',
          'verify',
          'converge',
          'completed',
        ])
        .optional(),
      status: z.enum(['active', 'blocked', 'completed']).optional(),
      playbook: z.enum(['build', 'ui', 'docs', 'polish', 'maintain']).optional(),
      waves: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.enum(['pending', 'in_progress', 'done', 'blocked']),
            dependsOn: z.array(z.string()).optional(),
            paths: z.array(z.string()).optional(),
            tasks: z.array(z.string()),
          }),
        )
        .optional(),
      blueprint: z.string().optional(),
      clarifyAnswers: z
        .array(z.object({ questionId: z.string(), answer: z.string() }))
        .optional(),
      brainRefs: z.array(z.string()).optional(),
      remembered: z.boolean().optional(),
      signals: z
        .object({
          gatesHonored: z.boolean().optional(),
          verifyOk: z.boolean().optional(),
          checklistOk: z.boolean().optional(),
          checklistDone: z.array(z.string()).optional(),
          checklistNotes: z.record(z.string()).optional(),
          wavesCompleted: z.number().optional(),
          wavesTotal: z.number().optional(),
          express: z.boolean().optional(),
          clarifyQuestionCount: z.number().optional(),
          proposeWavesUsed: z.boolean().optional(),
          proposeQuality: z.enum(['code', 'map', 'generic']).optional(),
          rememberedAt: z.string().optional(),
          completedAt: z.string().optional(),
        })
        .optional(),
      scripts: z
        .object({
          test: z.string().optional(),
          lint: z.string().optional(),
          typecheck: z.string().optional(),
          format: z.string().optional(),
          build: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  projectId,
};
