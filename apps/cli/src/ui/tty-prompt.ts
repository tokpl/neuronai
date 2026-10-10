import { stdin as input, stdout as output } from 'node:process';

import { NeuronCliError } from '../diagnostics/errors.js';
import { canPromptInteractively } from './prompt-env.js';
import { ui } from './output.js';

export type PromptChoice<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export type SelectKey =
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'space' }
  | { type: 'enter' }
  | { type: 'abort' }
  | { type: 'unknown' };

export type SelectMode = 'single' | 'multi';

export type SelectState = {
  mode: SelectMode;
  cursor: number;
  selected: Set<number>;
  choiceCount: number;
  requireOne: boolean;
  warning: string | null;
  done: boolean;
  aborted: boolean;
  /** Indices confirmed on enter (single: one index; multi: selected set). */
  resultIndices: number[] | null;
};

const ESC = '\u001b';
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;
const CURSOR_TO_COL1 = `\r`;
const UP_N = (n: number) => (n > 0 ? `${ESC}[${n}A` : '');

/** Parse one stdin chunk into a logical key (handles CSI arrow sequences). */
export function parseSelectKey(chunk: string): SelectKey {
  if (chunk === '\u0003') return { type: 'abort' };
  if (chunk === '\u001b') return { type: 'abort' };
  if (chunk === '\r' || chunk === '\n') return { type: 'enter' };
  if (chunk === ' ') return { type: 'space' };
  if (chunk === '\u001b[A' || chunk === '\u001bOA') return { type: 'up' };
  if (chunk === '\u001b[B' || chunk === '\u001bOB') return { type: 'down' };
  // Lone Esc often arrives before CSI; treat incomplete CSI as unknown (buffer elsewhere).
  if (chunk.startsWith('\u001b[') || chunk.startsWith('\u001bO')) {
    if (chunk.endsWith('A')) return { type: 'up' };
    if (chunk.endsWith('B')) return { type: 'down' };
    // Esc then something else → abort (Esc alone already handled; Esc+[ alone wait).
    if (chunk === '\u001b[' || chunk === '\u001bO') return { type: 'unknown' };
  }
  return { type: 'unknown' };
}

export function createSelectState(options: {
  mode: SelectMode;
  choiceCount: number;
  initialSelectedIndices?: number[];
  requireOne?: boolean;
  initialCursor?: number;
}): SelectState {
  const selected = new Set(options.initialSelectedIndices ?? []);
  return {
    mode: options.mode,
    cursor: Math.min(
      Math.max(0, options.initialCursor ?? 0),
      Math.max(0, options.choiceCount - 1),
    ),
    selected,
    choiceCount: options.choiceCount,
    requireOne: options.requireOne === true,
    warning: null,
    done: false,
    aborted: false,
    resultIndices: null,
  };
}

/**
 * Pure reducer for select/multi-select. Returns next state (does not mutate).
 */
export function reduceSelectState(
  state: SelectState,
  key: SelectKey,
  emptyWarning = 'Select at least one option',
): SelectState {
  if (state.done || state.aborted) return state;

  if (key.type === 'abort') {
    return { ...state, aborted: true, done: true, warning: null, resultIndices: null };
  }

  if (key.type === 'up') {
    const cursor = state.choiceCount === 0 ? 0 : (state.cursor - 1 + state.choiceCount) % state.choiceCount;
    return { ...state, cursor, warning: null };
  }

  if (key.type === 'down') {
    const cursor = state.choiceCount === 0 ? 0 : (state.cursor + 1) % state.choiceCount;
    return { ...state, cursor, warning: null };
  }

  if (key.type === 'space') {
    if (state.mode !== 'multi') return { ...state, warning: null };
    const selected = new Set(state.selected);
    if (selected.has(state.cursor)) selected.delete(state.cursor);
    else selected.add(state.cursor);
    return { ...state, selected, warning: null };
  }

  if (key.type === 'enter') {
    if (state.mode === 'single') {
      return {
        ...state,
        done: true,
        warning: null,
        resultIndices: state.choiceCount > 0 ? [state.cursor] : [],
      };
    }
    if (state.requireOne && state.selected.size === 0) {
      return { ...state, warning: emptyWarning };
    }
    return {
      ...state,
      done: true,
      warning: null,
      resultIndices: [...state.selected].sort((a, b) => a - b),
    };
  }

  return state;
}

export type TtySelectOptions<T extends string> = {
  title: string;
  detail?: string[];
  choices: Array<PromptChoice<T>>;
  mode: SelectMode;
  /** Single-select default highlight / non-interactive value. */
  defaultValue?: T;
  /** Multi: pre-checked values when interactive. */
  initialSelected?: T[];
  /** Multi: non-interactive result. */
  defaultSelected?: T[];
  requireOne?: boolean;
  emptyWarning?: string;
  useDefaults?: boolean;
  footer?: string;
};

function indexOfValue<T extends string>(choices: Array<PromptChoice<T>>, value: T): number {
  const i = choices.findIndex((c) => c.value === value);
  return i >= 0 ? i : 0;
}

function paintDim(text: string): string {
  const useColor = !process.env['NO_COLOR'] && process.stdout.isTTY !== false;
  return useColor ? `\u001b[2m${text}\u001b[0m` : text;
}

function paintCyan(text: string): string {
  const useColor = !process.env['NO_COLOR'] && process.stdout.isTTY !== false;
  return useColor ? `\u001b[36m${text}\u001b[0m` : text;
}

function paintBold(text: string): string {
  const useColor = !process.env['NO_COLOR'] && process.stdout.isTTY !== false;
  return useColor ? `\u001b[1m${text}\u001b[0m` : text;
}

function renderLines<T extends string>(
  state: SelectState,
  choices: Array<PromptChoice<T>>,
  footer: string,
): string[] {
  const lines: string[] = [];
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i]!;
    const active = i === state.cursor;
    const pointer = active ? paintCyan('›') : ' ';
    let mark: string;
    if (state.mode === 'multi') {
      mark = state.selected.has(i) ? paintCyan('[x]') : '[ ]';
    } else {
      mark = active ? paintCyan('(•)') : '( )';
    }
    const hint = c.hint ? paintDim(` — ${c.hint}`) : '';
    const label = active ? paintBold(c.label) : c.label;
    lines.push(`  ${pointer} ${mark} ${label}${hint}`);
  }
  if (footer) lines.push(paintDim(`  ${footer}`));
  if (state.warning) lines.push(paintDim(`  ! ${state.warning}`));
  return lines;
}

async function runTtySelectLoop<T extends string>(
  options: TtySelectOptions<T>,
): Promise<T[]> {
  const { choices, mode } = options;
  if (choices.length === 0) {
    throw new NeuronCliError({
      title: 'Neuron cannot show a prompt because:',
      reason: 'No choices were provided.',
      solution: 'This is a bug — re-run with --yes or report it.',
    });
  }

  const initialSelectedIndices =
    mode === 'multi'
      ? (options.initialSelected ?? [])
          .map((v) => choices.findIndex((c) => c.value === v))
          .filter((i) => i >= 0)
      : [];

  let state = createSelectState({
    mode,
    choiceCount: choices.length,
    initialSelectedIndices,
    requireOne: options.requireOne,
    initialCursor:
      mode === 'single' && options.defaultValue
        ? indexOfValue(choices, options.defaultValue)
        : 0,
  });

  const footer =
    options.footer ??
    (mode === 'multi'
      ? '↑↓ navigate · Space toggle · Enter confirm · Esc abort'
      : '↑↓ navigate · Enter confirm · Esc abort');
  const emptyWarning = options.emptyWarning ?? 'Select at least one option';

  let renderedLineCount = 0;

  const draw = (): void => {
    const lines = renderLines(state, choices, footer);
    if (renderedLineCount > 0) {
      output.write(UP_N(renderedLineCount) + CURSOR_TO_COL1);
    }
    for (let i = 0; i < lines.length; i++) {
      output.write(CLEAR_LINE + CURSOR_TO_COL1 + lines[i] + '\n');
    }
    // Clear leftover lines if the list shrank (e.g. warning removed).
    if (renderedLineCount > lines.length) {
      for (let i = 0; i < renderedLineCount - lines.length; i++) {
        output.write(CLEAR_LINE + CURSOR_TO_COL1 + '\n');
      }
      output.write(UP_N(renderedLineCount - lines.length));
    }
    renderedLineCount = lines.length;
  };

  ui.blank();
  ui.title(options.title);
  for (const line of options.detail ?? []) ui.info(line);
  ui.blank();
  output.write(HIDE_CURSOR);
  draw();

  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    output.write(SHOW_CURSOR);
    throw new NeuronCliError({
      title: 'Neuron cannot run an interactive prompt because:',
      reason: 'stdin is not a TTY.',
      solution: 'Use --yes for defaults, or run in an interactive terminal.',
      commands: ['neuron init --yes'],
    });
  }

  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  let buffer = '';
  let escTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    await new Promise<void>((resolve, reject) => {
      const applyKey = (key: SelectKey): void => {
        state = reduceSelectState(state, key, emptyWarning);

        if (state.aborted) {
          cleanup();
          reject(
            new NeuronCliError({
              title: 'Neuron init was cancelled because:',
              reason: 'You pressed Esc or Ctrl+C.',
              solution: 'Run neuron init again when you are ready.',
              commands: ['neuron init'],
            }),
          );
          return;
        }

        if (state.done) {
          cleanup();
          resolve();
          return;
        }

        draw();
      };

      const drain = (): void => {
        while (buffer.length > 0) {
          // Incomplete CSI / SS3 — wait for more bytes.
          if (buffer === '\u001b[' || buffer === '\u001bO') return;
          if (buffer.startsWith('\u001b[') || buffer.startsWith('\u001bO')) {
            const end = buffer.search(/[A-Za-z~]/);
            if (end === -1) return;
            const seq = buffer.slice(0, end + 1);
            buffer = buffer.slice(end + 1);
            applyKey(parseSelectKey(seq));
            if (state.done) return;
            continue;
          }

          // Lone Esc: wait briefly for a following CSI (arrows often split).
          if (buffer[0] === '\u001b' && buffer.length === 1) {
            if (escTimer) clearTimeout(escTimer);
            escTimer = setTimeout(() => {
              if (buffer === '\u001b') {
                buffer = '';
                applyKey({ type: 'abort' });
              } else {
                drain();
              }
            }, 35);
            return;
          }

          const ch = buffer[0]!;
          buffer = buffer.slice(1);
          applyKey(parseSelectKey(ch));
          if (state.done) return;
        }
      };

      const onData = (data: string | Buffer): void => {
        if (escTimer) {
          clearTimeout(escTimer);
          escTimer = undefined;
        }
        buffer += typeof data === 'string' ? data : data.toString('utf8');
        drain();
      };

      const cleanup = (): void => {
        if (escTimer) clearTimeout(escTimer);
        input.off('data', onData);
        if (typeof input.setRawMode === 'function') input.setRawMode(false);
      };

      input.on('data', onData);
    });
  } finally {
    if (escTimer) clearTimeout(escTimer);
    output.write(SHOW_CURSOR);
    // Move past the prompt block
    output.write('\n');
  }

  const indices = state.resultIndices ?? [];
  return indices.map((i) => choices[i]!.value);
}

/**
 * Interactive single-select (↑↓ + Enter). Falls back to defaultValue when non-interactive.
 */
export async function runAskSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<PromptChoice<T>>;
  defaultValue: T;
  useDefaults?: boolean;
  footer?: string;
}): Promise<T> {
  const { title, detail = [], choices, defaultValue, useDefaults, footer } = options;

  if (useDefaults || !canPromptInteractively()) {
    const chosen = choices.find((c) => c.value === defaultValue) ?? choices[0];
    if (chosen) ui.info(`${title} → ${chosen.label} (default)`);
    return defaultValue;
  }

  const values = await runTtySelectLoop({
    title,
    detail,
    choices,
    mode: 'single',
    defaultValue,
    footer,
  });
  return values[0] ?? defaultValue;
}

/**
 * Interactive multi-select (↑↓ + Space + Enter).
 */
export async function runAskMultiSelect<T extends string>(options: {
  title: string;
  detail?: string[];
  choices: Array<PromptChoice<T>>;
  initialSelected?: T[];
  defaultSelected: T[];
  requireOne?: boolean;
  emptyWarning?: string;
  useDefaults?: boolean;
  footer?: string;
}): Promise<T[]> {
  const {
    title,
    detail = [],
    choices,
    initialSelected = [],
    defaultSelected,
    requireOne,
    emptyWarning,
    useDefaults,
    footer,
  } = options;

  if (useDefaults || !canPromptInteractively()) {
    const labels = defaultSelected
      .map((v) => choices.find((c) => c.value === v)?.label ?? v)
      .join(', ');
    ui.info(`${title} → ${labels || '(none)'} (default)`);
    return [...defaultSelected];
  }

  return runTtySelectLoop({
    title,
    detail,
    choices,
    mode: 'multi',
    initialSelected,
    defaultSelected,
    requireOne,
    emptyWarning,
    footer,
  });
}
