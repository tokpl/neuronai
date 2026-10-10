import { describe, expect, it } from 'vitest';

import {
  createSelectState,
  parseSelectKey,
  reduceSelectState,
} from '../src/ui/tty-prompt.js';

describe('parseSelectKey', () => {
  it('maps arrows, space, enter, abort', () => {
    expect(parseSelectKey('\u001b[A')).toEqual({ type: 'up' });
    expect(parseSelectKey('\u001b[B')).toEqual({ type: 'down' });
    expect(parseSelectKey(' ')).toEqual({ type: 'space' });
    expect(parseSelectKey('\r')).toEqual({ type: 'enter' });
    expect(parseSelectKey('\n')).toEqual({ type: 'enter' });
    expect(parseSelectKey('\u0003')).toEqual({ type: 'abort' });
    expect(parseSelectKey('\u001b')).toEqual({ type: 'abort' });
  });
});

describe('reduceSelectState', () => {
  it('navigates with wrap-around', () => {
    let s = createSelectState({ mode: 'multi', choiceCount: 2 });
    s = reduceSelectState(s, { type: 'down' });
    expect(s.cursor).toBe(1);
    s = reduceSelectState(s, { type: 'down' });
    expect(s.cursor).toBe(0);
    s = reduceSelectState(s, { type: 'up' });
    expect(s.cursor).toBe(1);
  });

  it('toggles multi-select with space', () => {
    let s = createSelectState({ mode: 'multi', choiceCount: 2 });
    s = reduceSelectState(s, { type: 'space' });
    expect([...s.selected]).toEqual([0]);
    s = reduceSelectState(s, { type: 'down' });
    s = reduceSelectState(s, { type: 'space' });
    expect([...s.selected].sort()).toEqual([0, 1]);
    s = reduceSelectState(s, { type: 'space' });
    expect([...s.selected]).toEqual([0]);
  });

  it('rejects empty confirm when requireOne', () => {
    let s = createSelectState({ mode: 'multi', choiceCount: 2, requireOne: true });
    s = reduceSelectState(s, { type: 'enter' }, 'Select at least one IDE');
    expect(s.done).toBe(false);
    expect(s.warning).toBe('Select at least one IDE');
    expect(s.resultIndices).toBeNull();
  });

  it('confirms multi with one or both selected', () => {
    let s = createSelectState({ mode: 'multi', choiceCount: 2, requireOne: true });
    s = reduceSelectState(s, { type: 'space' });
    s = reduceSelectState(s, { type: 'enter' });
    expect(s.done).toBe(true);
    expect(s.resultIndices).toEqual([0]);

    s = createSelectState({ mode: 'multi', choiceCount: 2, requireOne: true });
    s = reduceSelectState(s, { type: 'space' });
    s = reduceSelectState(s, { type: 'down' });
    s = reduceSelectState(s, { type: 'space' });
    s = reduceSelectState(s, { type: 'enter' });
    expect(s.resultIndices).toEqual([0, 1]);
  });

  it('single-select confirms cursor without space', () => {
    let s = createSelectState({ mode: 'single', choiceCount: 3, initialCursor: 1 });
    s = reduceSelectState(s, { type: 'enter' });
    expect(s.done).toBe(true);
    expect(s.resultIndices).toEqual([1]);
  });

  it('ignores space in single mode', () => {
    let s = createSelectState({ mode: 'single', choiceCount: 2 });
    s = reduceSelectState(s, { type: 'space' });
    expect(s.selected.size).toBe(0);
    expect(s.done).toBe(false);
  });

  it('aborts on Esc / Ctrl+C', () => {
    let s = createSelectState({ mode: 'multi', choiceCount: 2, requireOne: true });
    s = reduceSelectState(s, { type: 'abort' });
    expect(s.aborted).toBe(true);
    expect(s.done).toBe(true);
    expect(s.resultIndices).toBeNull();
  });

  it('starts with nothing selected by default', () => {
    const s = createSelectState({ mode: 'multi', choiceCount: 2, requireOne: true });
    expect(s.selected.size).toBe(0);
    expect(s.cursor).toBe(0);
  });
});
