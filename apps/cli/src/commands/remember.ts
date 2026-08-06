import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { findDuplicate } from '@neuronai/brain';
import type { MemoryType } from '@neuronai/types';

import { NeuronCliError } from '../diagnostics/errors.js';
import { isNeuronInitialized } from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { askChoice, canPromptInteractively } from '../ui/prompt.js';
import { ui } from '../ui/output.js';

const TYPE_CHOICES: Array<{ value: MemoryType; label: string; hint: string }> = [
  { value: 'architecture_decision', label: 'Decision', hint: 'a choice the project has made' },
  { value: 'pattern', label: 'Pattern', hint: 'how things are done here' },
  { value: 'mistake', label: 'Warning', hint: 'something that went wrong before' },
  { value: 'business_rule', label: 'Rule', hint: 'a constraint that must hold' },
  { value: 'knowledge', label: 'Fact', hint: 'anything else worth keeping' },
];

/**
 * Ask-before-remember from the terminal.
 *
 * The MCP flow asks through the agent host; this is the same consent step for
 * people working in a shell. Nothing is written before the user confirms.
 */
export async function runRemember(
  text: string | undefined,
  cwd = process.cwd(),
  options: { type?: string; title?: string; yes?: boolean } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    throw new NeuronCliError({
      title: 'Neuron cannot remember anything yet because:',
      reason: 'This project has no Project Brain.',
      solution: 'Create one first, then run this command again.',
      commands: ['neuron init'],
    });
  }

  const content = (text ?? '').trim();
  if (!content) {
    throw new NeuronCliError({
      title: 'Nothing to remember because:',
      reason: 'No text was provided.',
      solution: 'Pass what you want the project to remember, in quotes.',
      commands: ['neuron remember "Rate limiting belongs in middleware, not handlers"'],
    });
  }

  const session = await openProjectSession(cwd);

  const type =
    (options.type as MemoryType | undefined) ??
    (await askChoice({
      title: 'What kind of knowledge is this?',
      detail: ['This decides how the memory is ranked and where it appears in context.'],
      choices: TYPE_CHOICES,
      defaultValue: 'architecture_decision',
      useDefaults: options.yes,
    }));

  const title = options.title?.trim() || deriveTitle(content);

  const duplicate = findDuplicate({ type, title, content }, session.listMemories());
  if (duplicate) {
    ui.blank();
    ui.warn(`The project already knows this: "${duplicate.existing.title}"`);
    ui.suggest(`Update it instead: neuron remember --title "${duplicate.existing.title}" "…"`);
    return;
  }

  ui.blank();
  ui.title('Remember this?');
  ui.blank();
  ui.kv('Type', TYPE_CHOICES.find((c) => c.value === type)?.label ?? type);
  ui.kv('Title', title);
  ui.blank();
  console.log(content);
  ui.blank();

  const action = await askAction(Boolean(options.yes));

  if (action === 'no') {
    ui.info('Not saved.');
    return;
  }

  let finalTitle = title;
  if (action === 'edit') {
    finalTitle = (await askLine('Title', title)) || title;
  }

  const memory = await session.engine.createMemory({
    projectId: session.project.projectId,
    type,
    title: finalTitle,
    content,
    source: 'user',
    tags: ['manual'],
  });

  ui.blank();
  ui.success(`Remembered: ${memory.title}`);
  ui.info(`  Stored in ${session.brain.paths.knowledge.replace(session.cwd, '.')}`);
  ui.suggest(`Verify: neuron search "${finalTitle.split(/\s+/).slice(0, 4).join(' ')}"`);
}

type RememberAction = 'yes' | 'edit' | 'no';

async function askAction(useDefaults: boolean): Promise<RememberAction> {
  if (useDefaults || !canPromptInteractively()) {
    ui.info('Remember this? → Yes (default)');
    return 'yes';
  }
  return askChoice<RememberAction>({
    title: 'Add this to the Project Brain?',
    choices: [
      { value: 'yes', label: 'Yes — remember it' },
      { value: 'edit', label: 'Yes — but let me retitle it' },
      { value: 'no', label: 'No — skip' },
    ],
    defaultValue: 'yes',
  });
}

async function askLine(label: string, fallback: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(`${label} [${fallback}]: `)).trim();
  } finally {
    rl.close();
  }
}

/** First sentence or clause, so a pasted paragraph still gets a usable title. */
function deriveTitle(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  const clause = flat.split(/(?<=[.!?])\s|[:;]\s/)[0] ?? flat;
  const title = clause.length > 72 ? `${clause.slice(0, 71).trimEnd()}…` : clause;
  return title.replace(/[.]$/, '');
}
