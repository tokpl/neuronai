import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { ui } from './output.js';

export function canPromptInteractively(): boolean {
  return Boolean(input.isTTY && output.isTTY) && process.env['CI'] !== 'true';
}

/**
 * Ask a numbered multiple-choice question.
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
    const answer = (
      await rl.question(`Choose 1-${choices.length} [${defaultIndex + 1}]: `)
    ).trim();
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
