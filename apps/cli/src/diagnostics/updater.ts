import { openProjectBrain, type BrainPrefs } from '@neuronai/brain';

import { CLI_VERSION, loadMetadata, saveMetadata } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';
import { validateLocalConfig } from '../config/local-config.js';

export interface UpdateReport {
  cliVersion: string;
  schemaVersion: number;
  brainMigrated: boolean;
  notes: string[];
}

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Local-first updater — prefs + metadata via ProjectBrain.
 */
export class NeuronUpdater {
  async checkAndApply(cwd = process.cwd()): Promise<UpdateReport> {
    const notes: string[] = [];
    let schemaVersion = CURRENT_SCHEMA_VERSION;
    let brainMigrated = false;

    notes.push(`CLI version: ${CLI_VERSION}`);
    notes.push('Self-update: use your package manager (pnpm / npm) when a newer release ships.');

    try {
      const brain = await openProjectBrain(cwd);
      const raw = (brain.prefs ?? {}) as Record<string, unknown>;
      const stored = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : 0;
      if (stored < CURRENT_SCHEMA_VERSION || !brain.prefs) {
        const privacy = (raw['privacy'] as Record<string, unknown> | undefined) ?? {};
        if (privacy['telemetry'] === undefined) privacy['telemetry'] = false;
        if (privacy['localOnly'] === undefined) privacy['localOnly'] = true;
        raw['privacy'] = privacy;
        raw['schemaVersion'] = CURRENT_SCHEMA_VERSION;
        if (!raw['scan']) {
          raw['scan'] = {
            depth: 'fast',
            ignore: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
          };
        }
        if (!raw['providers']) {
          raw['providers'] = { local: { enabled: true } };
        }
        const parsed = validateLocalConfig(raw);
        await brain.savePrefs(parsed as unknown as BrainPrefs);
        notes.push(`Prefs schema migrated ${stored} → ${CURRENT_SCHEMA_VERSION}`);
        schemaVersion = CURRENT_SCHEMA_VERSION;
        brainMigrated = true;
      } else {
        schemaVersion = stored || CURRENT_SCHEMA_VERSION;
        notes.push(`Prefs schema: v${schemaVersion}`);
      }
      await brain.evolve();
      notes.push(`Brain health: ${brain.status().healthPercent}%`);
    } catch {
      notes.push('Prefs not found - run neuron init first.');
    }

    try {
      const meta = await loadMetadata(cwd);
      if (meta.version !== CLI_VERSION) {
        await saveMetadata({ ...meta, version: CLI_VERSION }, cwd);
        brainMigrated = true;
        notes.push(`Brain metadata version ${meta.version} → ${CLI_VERSION}`);
      } else {
        notes.push(`Brain metadata version: ${meta.version}`);
      }
    } catch {
      notes.push('Brain metadata unavailable.');
    }

    return {
      cliVersion: CLI_VERSION,
      schemaVersion,
      brainMigrated,
      notes,
    };
  }
}

export async function runUpdate(cwd = process.cwd()): Promise<void> {
  ui.title('Neuron update');
  ui.blank();
  ui.info('Local-first updater - no cloud account required.');
  ui.blank();

  const report = await new NeuronUpdater().checkAndApply(cwd);
  for (const note of report.notes) {
    ui.success(note);
  }

  ui.blank();
  ui.suggest('Refresh project knowledge: neuron scan --update');
  ui.suggest('Full rescan: neuron scan --deep');
}
