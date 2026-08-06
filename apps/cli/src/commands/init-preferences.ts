import type { NeuronLocalConfig } from '../config/local-config.js';
import { askChoice } from '../ui/prompt.js';
import type { GitIgnorePreset } from '../services/gitignore.js';

export type MemorySavePreference = {
  autoSave: boolean;
  privacyMode: NeuronLocalConfig['privacy']['mode'];
};

export async function askInitPreferences(options: {
  useDefaults?: boolean;
}): Promise<{
  memory: MemorySavePreference;
  gitignore: GitIgnorePreset;
}> {
  const useDefaults = options.useDefaults === true;

  const memoryChoice = await askChoice({
    title: 'How should Neuron remember project knowledge?',
    detail: [
      'This only affects durable engineering knowledge — never raw chat logs.',
      'Default asks: “Should I remember this?” — Yes / No (or rephrase).',
      'You can change it later in .neuron/config.json (privacy.mode).',
    ],
    choices: [
      {
        value: 'suggest',
        label: 'Ask me (recommended)',
        hint: 'ask “Should I remember this?” before saving',
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

  const gitignore = await askChoice({
    title: 'Update .gitignore for Neuron?',
    detail: [
      'Team Brain shares .neuron/*.json via Git.',
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

  return { memory, gitignore };
}
