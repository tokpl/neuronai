import type { SyncMode, TeamBrainDocument } from '../types.js';

export interface SyncResult {
  mode: SyncMode;
  ok: boolean;
  detail: string;
  /** Never auto-shares — sync is opt-in and configured */
  shared: boolean;
}

/**
 * KnowledgeSyncProvider abstraction.
 * local_only (default) · self_hosted (stub) · cloud_future (not implemented).
 * No public cloud sync.
 */
export interface KnowledgeSyncProvider {
  readonly mode: SyncMode;
  push(doc: TeamBrainDocument): Promise<SyncResult>;
  pull(): Promise<SyncResult>;
}

export class LocalOnlySyncProvider implements KnowledgeSyncProvider {
  readonly mode = 'local_only' as const;

  async push(_doc: TeamBrainDocument): Promise<SyncResult> {
    return {
      mode: this.mode,
      ok: true,
      detail: 'Local-only — knowledge stays on this machine. No network sync.',
      shared: false,
    };
  }

  async pull(): Promise<SyncResult> {
    return {
      mode: this.mode,
      ok: true,
      detail: 'Local-only — nothing to pull.',
      shared: false,
    };
  }
}

/** Stub for future self-hosted team brain servers — requires explicit config. */
export class SelfHostedSyncProvider implements KnowledgeSyncProvider {
  readonly mode = 'self_hosted' as const;

  constructor(private readonly endpoint?: string) {}

  async push(_doc: TeamBrainDocument): Promise<SyncResult> {
    if (!this.endpoint) {
      return {
        mode: this.mode,
        ok: false,
        detail: 'Self-hosted sync requires an endpoint in configuration. Nothing was shared.',
        shared: false,
      };
    }
    return {
      mode: this.mode,
      ok: false,
      detail: `Self-hosted sync stub (${this.endpoint}) — not connected yet. No automatic sharing.`,
      shared: false,
    };
  }

  async pull(): Promise<SyncResult> {
    return this.push({} as TeamBrainDocument);
  }
}

export function createKnowledgeSyncProvider(
  mode: SyncMode = 'local_only',
  endpoint?: string,
): KnowledgeSyncProvider {
  if (mode === 'self_hosted') return new SelfHostedSyncProvider(endpoint);
  if (mode === 'cloud_future') {
    return {
      mode: 'cloud_future',
      async push() {
        return {
          mode: 'cloud_future',
          ok: false,
          detail: 'Public cloud sync is not implemented. Use local_only or self_hosted.',
          shared: false,
        };
      },
      async pull() {
        return {
          mode: 'cloud_future',
          ok: false,
          detail: 'Public cloud sync is not implemented.',
          shared: false,
        };
      },
    };
  }
  return new LocalOnlySyncProvider();
}
