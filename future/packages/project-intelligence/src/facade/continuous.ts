import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createProjectEventBus } from '../events/bus.js';
import { createProjectTimeline } from '../timeline/timeline.js';
import {
  createContinuousUpdateEngine,
  type ContinuousUpdateEngine,
} from '../updates/engine.js';
import { createNeuronWatchMode, type NeuronWatchMode } from '../watcher/watch-mode.js';
import type { ContinuousState, LiveProjectHealth } from '../types.js';

/**
 * Internal continuous intelligence API — no plugin marketplace / third-party extensions.
 */
export class ContinuousProjectIntelligence {
  private readonly bus = createProjectEventBus();
  private readonly timeline = createProjectTimeline();
  readonly engine: ContinuousUpdateEngine = createContinuousUpdateEngine(this.bus, this.timeline);
  private watch: NeuronWatchMode | null = null;

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, 'continuous-intelligence.json'), 'utf8'),
      ) as ContinuousState;
      for (const e of raw.events.slice().reverse()) {
        this.engine.handleEvent(e);
      }
    } catch {
      /* fresh */
    }
  }

  async save(neuronDir: string, projectRoot: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, 'continuous-intelligence.json');
    const snap = this.engine.snapshot(projectRoot);
    await writeFile(path, JSON.stringify(snap, null, 2), 'utf8');
    await writeFile(join(neuronDir, 'timeline.md'), this.engine.timelineMarkdown(), 'utf8');
    return path;
  }

  noteFileChange(path: string, kind: 'created' | 'changed' | 'deleted' = 'changed', detail?: string) {
    const type =
      kind === 'created' ? 'FILE_CREATED' : kind === 'deleted' ? 'FILE_DELETED' : 'FILE_CHANGED';
    const event = this.bus.emit(type, { path, detail });
    this.engine.handleEvent(event);
    return event;
  }

  noteDependencyChange(detail: string) {
    const event = this.bus.emit('DEPENDENCY_CHANGED', { detail });
    this.engine.handleEvent(event);
    return event;
  }

  checkDrift(path: string, content: string) {
    return this.engine.recordDrift(path, content);
  }

  async analyzeLatestCommit(cwd: string) {
    return this.engine.ingestGitHead(cwd);
  }

  projectChanges(limit?: number) {
    return this.engine.projectChanges(limit);
  }

  pendingMemories() {
    return this.engine.pendingMemories();
  }

  detectDrift() {
    return this.engine.detectDrift();
  }

  liveHealth(): LiveProjectHealth {
    return this.engine.liveHealth();
  }

  startWatch(root: string, onEvent?: (msg: string) => void): void {
    this.watch = createNeuronWatchMode(this.engine);
    this.watch.start({ root, debounceMs: 500, pollGitMs: 15_000, onEvent });
  }

  stopWatch(): void {
    this.watch?.stop();
    this.watch = null;
  }
}

export function createContinuousProjectIntelligence(): ContinuousProjectIntelligence {
  return new ContinuousProjectIntelligence();
}
