import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SecurityAuditEntry, SecurityEventType } from '../types.js';
import { newId, nowIso } from '../types.js';

const AUDIT_FILE = 'security-audit.json';

/**
 * Local security audit log — blocked actions, sanitization, permission changes.
 */
export class SecurityAuditLog {
  private entries: SecurityAuditEntry[] = [];
  private maxEntries = 200;

  async load(neuronDir: string): Promise<void> {
    try {
      const raw = JSON.parse(
        await readFile(join(neuronDir, AUDIT_FILE), 'utf8'),
      ) as { entries?: SecurityAuditEntry[] };
      this.entries = raw.entries ?? [];
    } catch {
      this.entries = [];
    }
  }

  async save(neuronDir: string): Promise<string> {
    await mkdir(neuronDir, { recursive: true });
    const path = join(neuronDir, AUDIT_FILE);
    await writeFile(
      path,
      `${JSON.stringify({ version: 1, entries: this.entries, updatedAt: nowIso() }, null, 2)}\n`,
      'utf8',
    );
    return path;
  }

  record(
    type: SecurityEventType,
    summary: string,
    details?: Record<string, unknown>,
  ): SecurityAuditEntry {
    const entry: SecurityAuditEntry = {
      id: newId('aud'),
      type,
      at: nowIso(),
      summary,
      details: scrubDetails(details),
    };
    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, this.maxEntries);
    return entry;
  }

  list(limit = 50): SecurityAuditEntry[] {
    return this.entries.slice(0, limit);
  }

  blockedActions(): string[] {
    return this.entries
      .filter((e) => e.type === 'permission.denied' || e.type === 'mcp.blocked' || e.type === 'sandbox.blocked' || e.type === 'memory.rejected')
      .map((e) => e.summary)
      .slice(0, 40);
  }
}

function scrubDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (/secret|password|token|key/i.test(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      out[k] = v.slice(0, 200);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createSecurityAuditLog(): SecurityAuditLog {
  return new SecurityAuditLog();
}
