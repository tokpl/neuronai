import type { DeveloperSession } from '../types.js';
import { newId, nowIso } from '../types.js';

/**
 * Technical developer sessions only — no time-tracking analytics on people.
 */
export class SessionStore {
  private sessions: DeveloperSession[] = [];

  load(sessions: DeveloperSession[]): void {
    this.sessions = [...sessions];
  }

  list(): DeveloperSession[] {
    return [...this.sessions];
  }

  get(id: string): DeveloperSession | undefined {
    return this.sessions.find((s) => s.id === id);
  }

  active(): DeveloperSession | undefined {
    return this.sessions.find((s) => s.status === 'active' || s.status === 'paused');
  }

  start(input: {
    project: string;
    activeArea: string;
    relatedFiles?: string[];
    relatedTasks?: string[];
    decisions?: string[];
    unfinishedWork?: string[];
    branch?: string;
  }): DeveloperSession {
    // Close any lingering active session as paused technical state
    for (const s of this.sessions) {
      if (s.status === 'active') s.status = 'paused';
    }
    const session: DeveloperSession = {
      id: newId('ses'),
      project: input.project,
      startTime: nowIso(),
      endTime: null,
      activeArea: input.activeArea,
      relatedFiles: input.relatedFiles ?? [],
      relatedTasks: input.relatedTasks ?? [],
      decisions: input.decisions ?? [],
      unfinishedWork: input.unfinishedWork ?? [],
      summary: null,
      branch: input.branch,
      commits: [],
      status: 'active',
    };
    this.sessions.unshift(session);
    return session;
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        DeveloperSession,
        | 'activeArea'
        | 'relatedFiles'
        | 'relatedTasks'
        | 'decisions'
        | 'unfinishedWork'
        | 'summary'
        | 'branch'
        | 'commits'
        | 'status'
      >
    >,
  ): DeveloperSession {
    const s = this.require(id);
    Object.assign(s, patch);
    return s;
  }

  close(id: string, summary: string): DeveloperSession {
    const s = this.require(id);
    s.status = 'closed';
    s.endTime = nowIso();
    s.summary = summary;
    return s;
  }

  private require(id: string): DeveloperSession {
    const s = this.get(id);
    if (!s) throw new Error(`Unknown session: ${id}`);
    return s;
  }
}

export function createSessionStore(): SessionStore {
  return new SessionStore();
}
