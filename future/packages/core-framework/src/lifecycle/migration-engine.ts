import type { MigrationContext, MigrationStep } from '../types.js';
import { compareSemver } from '../types.js';
import { NeuronError } from '../errors/neuron-error.js';

/**
 * NeuronMigrationEngine — memory / graph / config schema migrations.
 * No remote code execution; steps are registered in-process only.
 */
export class NeuronMigrationEngine {
  private readonly steps: MigrationStep[] = [];

  register(step: MigrationStep): void {
    this.steps.push(step);
  }

  list(): MigrationStep[] {
    return [...this.steps].sort((a, b) => compareSemver(a.fromVersion, b.fromVersion));
  }

  async migrate(input: {
    neuronDir: string;
    fromVersion: string;
    toVersion: string;
    dryRun?: boolean;
  }): Promise<{ applied: string[]; log: string[] }> {
    if (compareSemver(input.toVersion, input.fromVersion) < 0) {
      throw new NeuronError({
        category: 'migration',
        severity: 'high',
        module: 'core',
        message: `Cannot migrate backwards ${input.fromVersion} → ${input.toVersion}`,
        solutionHint: 'Choose a higher target version.',
      });
    }

    const ctx: MigrationContext = {
      neuronDir: input.neuronDir,
      dryRun: input.dryRun === true,
      log: [],
    };
    const applied: string[] = [];
    for (const step of this.list()) {
      if (
        compareSemver(step.fromVersion, input.fromVersion) >= 0 &&
        compareSemver(step.toVersion, input.toVersion) <= 0
      ) {
        ctx.log.push(`${ctx.dryRun ? '[dry-run] ' : ''}Applying ${step.id}: ${step.description}`);
        if (!ctx.dryRun) {
          await step.apply(ctx);
        }
        applied.push(step.id);
      }
    }
    return { applied, log: ctx.log };
  }
}

export function createNeuronMigrationEngine(): NeuronMigrationEngine {
  const engine = new NeuronMigrationEngine();
  // Built-in no-op / documentation steps for core schemas
  engine.register({
    id: 'config-v1-privacy',
    fromVersion: '0.0.0',
    toVersion: '0.1.0',
    target: 'config',
    description: 'Ensure privacy.telemetry defaults to false in project config',
    apply: (ctx) => {
      ctx.log.push('privacy.telemetry=false (documented default)');
    },
  });
  engine.register({
    id: 'memory-schema-v1',
    fromVersion: '0.0.0',
    toVersion: '0.1.0',
    target: 'memory',
    description: 'Memory store schema baseline',
    apply: (ctx) => {
      ctx.log.push(`memory schema baseline for ${ctx.neuronDir}`);
    },
  });
  engine.register({
    id: 'graph-schema-v1',
    fromVersion: '0.0.0',
    toVersion: '0.1.0',
    target: 'graph',
    description: 'Knowledge graph schema baseline',
    apply: (ctx) => {
      ctx.log.push(`graph schema baseline for ${ctx.neuronDir}`);
    },
  });
  return engine;
}
