import { z } from 'zod';

/**
 * Input schemas for the seven MCP tools.
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
