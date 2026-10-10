import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { canPromptInteractively } from './prompt-env.js';
import { runAskMultiSelect, runAskSelect } from './tty-prompt.js';
import { ui } from './output.js';

export { canPromptInteractively } from './prompt-env.js';

/**
 * Ask a numbered multiple-choice question (legacy — used by `neuron remember`).
 * When non-interactive (or `useDefaults`), returns `defaultValue` without prompting.
 */
export async function askChoice<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<{ value: T; label: string; hint?: string }>;
  defaultValue: T;
  useDefaults?: boolean;
}): Promise<T> {
  const { title, detail = [], choices, defaultValue, useDefaults } = options;

  if (useDefaults || !canPromptInteractively()) {
    const chosen = choices.find((c) => c.value === defaultValue) ?? choices[0];
    if (chosen) {
      ui.info(`${title} → ${chosen.label} (default)`);
    }
    return defaultValue;
  }

  ui.blank();
  ui.title(title);
  for (const line of detail) ui.info(line);
  ui.blank();
  choices.forEach((c, i) => {
    const mark = c.value === defaultValue ? '*' : ' ';
    const hint = c.hint ? ` — ${c.hint}` : '';
    console.log(`  ${mark} ${i + 1}) ${c.label}${hint}`);
  });
  ui.blank();

  const rl = createInterface({ input, output });
  try {
    const defaultIndex = Math.max(
      0,
      choices.findIndex((c) => c.value === defaultValue),
    );
    const answer = (await rl.question(`Choose 1-${choices.length} [${defaultIndex + 1}]: `)).trim();
    if (!answer) return defaultValue;
    const n = Number.parseInt(answer, 10);
    if (Number.isFinite(n) && n >= 1 && n <= choices.length) {
      return choices[n - 1]!.value;
    }
    ui.warn(`Invalid choice — using default (${choices[defaultIndex]!.label}).`);
    return defaultValue;
  } finally {
    rl.close();
  }
}

export async function askConfirm(options: {
  question: string;
  detail?: string[];
  defaultYes?: boolean;
  useDefaults?: boolean;
}): Promise<boolean> {
  const { question, detail = [], defaultYes = true, useDefaults } = options;
  if (useDefaults || !canPromptInteractively()) {
    ui.info(`${question} → ${defaultYes ? 'yes' : 'no'} (default)`);
    return defaultYes;
  }

  ui.blank();
  for (const line of detail) ui.info(line);
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} [${hint}]: `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    if (['y', 'yes'].includes(answer)) return true;
    if (['n', 'no'].includes(answer)) return false;
    ui.warn(`Unrecognized answer — using ${defaultYes ? 'yes' : 'no'}.`);
    return defaultYes;
  } finally {
    rl.close();
  }
}

/** Arrow-key single-select for `neuron init` prefs. */
export async function askSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<{ value: T; label: string; hint?: string }>;
  defaultValue: T;
  useDefaults?: boolean;
  footer?: string;
}): Promise<T> {
  return runAskSelect(options);
}

/** Arrow-key multi-select (Space toggle) for `neuron init` IDE targets. */
export async function askMultiSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<{ value: T; label: string; hint?: string }>;
  initialSelected?: T[];
  defaultSelected: T[];
  requireOne?: boolean;
  emptyWarning?: string;
  useDefaults?: boolean;
  footer?: string;
}): Promise<T[]> {
  return runAskMultiSelect(options);
}
