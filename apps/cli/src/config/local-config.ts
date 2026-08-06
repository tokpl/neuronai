import { z } from 'zod';

const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.neuron/runtime',
  '.neuron/cache',
] as const;

/** Local project prefs stored at `.neuron/prefs.json` (via ProjectBrain). */
export const neuronLocalConfigSchema = z.object({
  schemaVersion: z.number().int().positive().default(1),
  project: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1).optional(),
    stack: z.array(z.string()).default([]),
  }),
  memory: z.object({
    autoSave: z.boolean().default(true),
    threshold: z.number().min(0).max(1).default(0.45),
  }),
  privacy: z
    .object({
      /** Memory write behaviour for agents */
      mode: z.enum(['manual', 'suggest', 'automatic']).default('suggest'),
      /** Never leave the machine */
      localOnly: z.boolean().default(true),
      /** Anonymous metrics - OFF by default; never collects source code */
      telemetry: z.boolean().default(false),
    })
    .default({ mode: 'suggest', localOnly: true, telemetry: false }),
  scan: z
    .object({
      depth: z.enum(['fast', 'deep', 'architecture']).default('fast'),
      ignore: z.array(z.string()).default([...DEFAULT_IGNORE]),
    })
    .default({ depth: 'fast', ignore: [...DEFAULT_IGNORE] }),
  integrations: z.object({
    cursor: z.boolean().default(true),
  }),
});

export type NeuronLocalConfig = z.infer<typeof neuronLocalConfigSchema>;

export function validateLocalConfig(input: unknown): NeuronLocalConfig {
  return neuronLocalConfigSchema.parse(input);
}

export interface NeuronMetadata {
  initializedAt: string;
  lastSyncAt: string | null;
  lastAnalyzeAt: string | null;
  memoryCount: number;
  version: string;
}

export { DEFAULT_IGNORE };
