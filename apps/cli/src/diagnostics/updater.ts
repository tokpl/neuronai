import { readFile, writeFile } from 'node:fs/promises';

import { CLI_VERSION, loadMetadata, neuronPaths, saveMetadata } from '../services/neuron-fs.js';
import { ui } from '../ui/output.js';

export interface UpdateReport {
  cliVersion: string;
  schemaVersion: number;
  brainMigrated: boolean;
  notes: string[];
}

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Neuron updater — CLI version check, config schema + brain metadata migrations.
 * Does not phone home; no mandatory cloud account.
 */
export class NeuronUpdater {
  async checkAndApply(cwd = process.cwd()): Promise<UpdateReport> {
    const notes: string[] = [];
    const paths = neuronPaths(cwd);
    let schemaVersion = CURRENT_SCHEMA_VERSION;
    let brainMigrated = false;

    notes.push(`CLI version: ${CLI_VERSION}`);
    notes.push('Self-update: use your package manager (pnpm / npm) when a newer release ships.');

    try {
      const raw = JSON.parse(await readFile(paths.config, 'utf8')) as Record<string, unknown>;
      const stored = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : 0;
      if (stored < CURRENT_SCHEMA_VERSION) {
        raw['schemaVersion'] = CURRENT_SCHEMA_VERSION;
        // Ensure privacy defaults exist after older configs
        const privacy = (raw['privacy'] as Record<string, unknown> | undefined) ?? {};
        if (privacy['telemetry'] === undefined) privacy['telemetry'] = false;
        if (privacy['localOnly'] === undefined) privacy['localOnly'] = true;
        raw['privacy'] = privacy;
        if (!raw['scan']) {
          raw['scan'] = {
            depth: 'fast',
            ignore: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
          };
        }
        if (!raw['providers']) {
          raw['providers'] = { local: { enabled: true } };
        }
        await writeFile(paths.config, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
        notes.push(`Config schema migrated ${stored} → ${CURRENT_SCHEMA_VERSION}`);
        schemaVersion = CURRENT_SCHEMA_VERSION;
      } else {
        schemaVersion = stored || CURRENT_SCHEMA_VERSION;
        notes.push(`Config schema: v${schemaVersion}`);
      }
    } catch {
      notes.push('Config not found — run neuron init first.');
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
  ui.info('Local-first updater — no cloud account required.');
  ui.blank();

  const report = await new NeuronUpdater().checkAndApply(cwd);
  for (const note of report.notes) {
    ui.success(note);
  }

  ui.blank();
  ui.suggest('Refresh project knowledge: neuron scan --update');
  ui.suggest('Full rescan: neuron scan --deep');
}
