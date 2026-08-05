import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

import { createSensitiveChangeFilter } from '../analyzers/sensitive-filter.js';
import { createChangeImportanceAnalyzer } from '../analyzers/importance.js';
import type { ContinuousUpdateEngine } from '../updates/engine.js';

export interface WatchModeOptions {
  root: string;
  /** Debounce ms for filesystem bursts */
  debounceMs?: number;
  /** Also poll git HEAD message */
  pollGitMs?: number;
  onEvent?: (message: string) => void;
}

/**
 * Local Neuron Watch Mode — filesystem + optional git poll. Never uploads data.
 */
export class NeuronWatchMode {
  private watcher: FSWatcher | null = null;
  private gitTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly sensitive = createSensitiveChangeFilter();
  private readonly importance = createChangeImportanceAnalyzer();
  private lastGitMessage = '';

  constructor(private readonly engine: ContinuousUpdateEngine) {}

  start(options: WatchModeOptions): void {
    this.stop();
    const debounceMs = options.debounceMs ?? 400;
    const notify = options.onEvent ?? (() => undefined);

    this.watcher = fsWatch(options.root, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const rel = filename.toString().replace(/\\/g, '/');
      if (!this.sensitive.allow(rel)) return;
      if (
        rel.includes('node_modules/') ||
        rel.includes('.git/') ||
        rel.includes('dist/') ||
        rel.startsWith('.neuron/')
      ) {
        return;
      }

      const key = rel;
      const prev = this.pending.get(key);
      if (prev) clearTimeout(prev);
      this.pending.set(
        key,
        setTimeout(() => {
          this.pending.delete(key);
          const imp = this.importance.classify(rel);
          if (imp === 'LOW') {
            notify(`skip LOW importance: ${rel}`);
            return;
          }
          const type = eventType === 'rename' ? 'FILE_CHANGED' : 'FILE_CHANGED';
          const event = this.engine.getBus().emit(type, {
            path: rel,
            detail: `fs ${eventType}`,
          });
          this.engine.handleEvent(event);
          notify(`${type} ${rel} (${imp})`);
        }, debounceMs),
      );
    });

    if (options.pollGitMs && options.pollGitMs > 0) {
      this.gitTimer = setInterval(() => {
        void this.engine.ingestGitHead(options.root).then((r) => {
          if (!r) return;
          if (r.insight.message === this.lastGitMessage) return;
          this.lastGitMessage = r.insight.message;
          notify(`GIT_COMMIT ${r.insight.message}`);
        });
      }, options.pollGitMs);
    }

    notify(`Neuron watch started (local-only) at ${join(options.root)}`);
  }

  stop(): void {
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
    this.watcher?.close();
    this.watcher = null;
    if (this.gitTimer) clearInterval(this.gitTimer);
    this.gitTimer = null;
  }
}

export function createNeuronWatchMode(engine: ContinuousUpdateEngine): NeuronWatchMode {
  return new NeuronWatchMode(engine);
}
