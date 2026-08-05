import type { ConfigLayer, ResolvedNeuronConfig } from '../types.js';

/**
 * NeuronConfig — merge default < env < project (project wins).
 */
export class NeuronConfig {
  private defaults: Record<string, unknown> = {
    mode: 'local',
    allowCloud: false,
    telemetry: false,
  };
  private env: Record<string, unknown> = {};
  private project: Record<string, unknown> = {};

  setDefaults(values: Record<string, unknown>): void {
    this.defaults = { ...this.defaults, ...values };
  }

  setEnv(values: Record<string, unknown>): void {
    this.env = { ...values };
  }

  /** Load common NEURON_* / NODE_ENV style keys from process.env */
  loadFromProcessEnv(env: NodeJS.ProcessEnv = process.env): void {
    const values: Record<string, unknown> = {};
    if (env['NEURON_MODE']) values['mode'] = env['NEURON_MODE'];
    if (env['NEURON_ALLOW_CLOUD'] === 'true') values['allowCloud'] = true;
    if (env['NEURON_ALLOW_CLOUD'] === 'false') values['allowCloud'] = false;
    if (env['NEURON_TELEMETRY'] === 'true') values['telemetry'] = true;
    if (env['NODE_ENV']) values['nodeEnv'] = env['NODE_ENV'];
    this.setEnv(values);
  }

  setProject(values: Record<string, unknown>): void {
    this.project = { ...values };
  }

  resolve(): ResolvedNeuronConfig {
    const layers: ConfigLayer[] = [
      { source: 'default', values: { ...this.defaults } },
      { source: 'env', values: { ...this.env } },
      { source: 'project', values: { ...this.project } },
    ];
    const values = {
      ...this.defaults,
      ...this.env,
      ...this.project,
    };
    return {
      values,
      layers,
      priority: ['project', 'env', 'default'],
    };
  }

  get<T = unknown>(key: string, fallback?: T): T {
    const v = this.resolve().values[key];
    return (v === undefined ? fallback : v) as T;
  }
}

export function createNeuronConfig(): NeuronConfig {
  return new NeuronConfig();
}
