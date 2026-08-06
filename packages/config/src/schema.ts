import { z } from 'zod';

/**
 * `neuron.config.json` — optional, project-root, human-editable.
 *
 * Only what the product actually reads. No provider registry, no server mode,
 * no security toggles: Neuron runs locally over stdio and has nothing to configure
 * in those directions.
 */
export const neuronConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    type: z.string().min(1).default('application'),
    stack: z.array(z.string()).default([]),
  }),
  memory: z.object({
    /** Whether agents may propose memories without being asked. */
    autoSave: z.boolean().default(true),
    /** Minimum importance for scanned knowledge to be kept. */
    importanceThreshold: z.number().min(0).max(1).default(0.45),
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
    autoSave: true,
    importanceThreshold: 0.45,
  },
};
