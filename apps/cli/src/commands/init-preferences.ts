import type { NeuronLocalConfig } from '../config/local-config.js';
import { askMultiSelect, askSelect } from '../ui/prompt.js';
import type { GitIgnorePreset } from '../services/gitignore.js';

export type MemorySavePreference = {
  autoSave: boolean;
  privacyMode: NeuronLocalConfig['privacy']['mode'];
};

export type IdeIntegrationFlags = {
  cursor: boolean;
  antigravity: boolean;
};

type IdeChoice = 'cursor' | 'antigravity';

export async function askInitPreferences(options: { useDefaults?: boolean }): Promise<{
  memory: MemorySavePreference;
  gitignore: GitIgnorePreset;
  ide: IdeIntegrationFlags;
}> {
  const useDefaults = options.useDefaults === true;

  const ideSelected = await askMultiSelect<IdeChoice>({
    title: 'Which IDE are you configuring Neuron for?',
    detail: [
      'Neuron configures MCP and editor rules for each selected environment.',
      'Select at least one — Space toggles, Enter confirms.',
    ],
    choices: [
      {
        value: 'cursor',
        label: 'Cursor',
        hint: 'configure .cursor/mcp.json and rules',
      },
      {
        value: 'antigravity',
        label: 'Antigravity IDE',
        hint: 'configure .agents/mcp_config.json, rules, skill + global MCP fallback',
      },
    ],
    initialSelected: [],
    defaultSelected: ['cursor'],
    requireOne: true,
    emptyWarning: 'Select at least one IDE',
    useDefaults,
  });

  const ide: IdeIntegrationFlags = {
    cursor: ideSelected.includes('cursor'),
    antigravity: ideSelected.includes('antigravity'),
  };

  const memoryChoice = await askSelect({
    title: 'How should Neuron remember project knowledge?',
    detail: [
      'This only affects durable engineering knowledge — never raw chat logs.',
      'Default asks before adding durable knowledge to the Project Brain — Yes / No / Edit.',
      'You can change it later in .neuron/prefs.json (privacy.mode).',
    ],
    choices: [
      {
        value: 'suggest',
        label: 'Ask me (recommended)',
        hint: 'ask before adding durable knowledge to the Project Brain',
      },
      {
        value: 'automatic',
        label: 'Remember automatically',
        hint: 'silent save when confidence is high',
      },
      {
        value: 'manual',
        label: 'Only when I ask',
        hint: 'never offer to save on its own',
      },
    ],
    defaultValue: 'suggest',
    useDefaults,
  });

  const memory: MemorySavePreference =
    memoryChoice === 'automatic'
      ? { autoSave: true, privacyMode: 'automatic' }
      : memoryChoice === 'manual'
        ? { autoSave: false, privacyMode: 'manual' }
        : { autoSave: true, privacyMode: 'suggest' };

  const gitignore = await askSelect({
    title: 'Update .gitignore for Neuron?',
    detail: [
      'Team Brain can share .neuron/brain/ + prefs.json via Git.',
      'Ephemeral folders (cache, runtime, logs, …) should usually stay ignored.',
    ],
    choices: [
      {
        value: 'ephemeral',
        label: 'Recommended',
        hint: 'ignore ephemeral .neuron/* only — keep brain JSON shareable',
      },
      {
        value: 'ephemeral+config',
        label: 'Recommended + ignore neuron.config.json',
        hint: 'same as above, plus root neuron.config.json',
      },
      {
        value: 'all-local',
        label: 'Local-only',
        hint: 'ignore entire .neuron/ + neuron.config.json (no Git team brain)',
      },
      {
        value: 'skip',
        label: 'Skip',
        hint: "don't touch .gitignore",
      },
    ],
    defaultValue: 'ephemeral',
    useDefaults,
  });

  return { memory, gitignore, ide };
}
