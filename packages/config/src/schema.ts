import { z } from 'zod';

const providerSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
});

export const neuronConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    type: z.string().min(1).default('application'),
    stack: z.array(z.string()).default([]),
  }),
  memory: z.object({
    autoSave: z.boolean().default(false),
    importanceThreshold: z.number().min(0).max(1).default(0.45),
    contextMaxTokens: z.number().int().positive().default(3000),
  }),
  providers: z.object({
    llm: providerSchema.optional(),
    embeddings: providerSchema.optional(),
  }),
  server: z.object({
    mode: z.enum(['local', 'cloud']).default('local'),
    bind: z.enum(['stdio', 'http']).default('stdio'),
  }),
  security: z.object({
    redaction: z.boolean().default(true),
    allowHardPurge: z.boolean().default(false),
  }),
});

export type NeuronConfig = z.infer<typeof neuronConfigSchema>;

export const defaultNeuronConfig: NeuronConfig = {
  project: {
    name: 'unnamed',
    type: 'application',
    stack: [],
  },
  memory: {
    autoSave: false,
    importanceThreshold: 0.45,
    contextMaxTokens: 3000,
  },
  providers: {},
  server: {
    mode: 'local',
    bind: 'stdio',
  },
  security: {
    redaction: true,
    allowHardPurge: false,
  },
};
