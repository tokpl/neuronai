import type {
  Incident,
  IncidentLink,
  IncidentSeverity,
  IncidentStatus,
  IncidentStoreDocument,
} from '../types.js';
import { newId, nowIso } from '../types.js';

export class IncidentRegistry {
  private incidents: Incident[] = [];

  load(doc: IncidentStoreDocument): void {
    this.incidents = [...doc.incidents];
  }

  list(): Incident[] {
    return [...this.incidents];
  }

  get(id: string): Incident | undefined {
    return this.incidents.find((i) => i.id === id);
  }

  create(input: {
    title: string;
    description: string;
    severity?: IncidentSeverity;
    affectedModules?: string[];
    errorSignature?: string;
    links?: IncidentLink[];
  }): Incident {
    const now = nowIso();
    const incident: Incident = {
      id: newId('inc'),
      title: input.title.trim(),
      description: input.description.trim(),
      severity: input.severity ?? inferSeverity(input.title, input.description),
      status: 'OPEN',
      affectedModules: input.affectedModules ?? inferModules(input.title, input.description),
      rootCause: null,
      solution: null,
      preventiveActions: [],
      lesson: null,
      links: input.links ?? [],
      errorSignature: input.errorSignature ?? signatureFrom(input.title, input.description),
      createdAt: now,
      resolvedAt: null,
      updatedAt: now,
    };
    this.incidents.unshift(incident);
    return incident;
  }

  updateStatus(id: string, status: IncidentStatus): Incident {
    const inc = this.require(id);
    inc.status = status;
    inc.updatedAt = nowIso();
    if (status === 'RESOLVED' || status === 'ARCHIVED') {
      inc.resolvedAt = inc.resolvedAt ?? nowIso();
    }
    return inc;
  }

  resolve(
    id: string,
    input: {
      rootCause: string;
      solution: string;
      preventiveActions?: string[];
      lesson?: string;
    },
  ): Incident {
    const inc = this.require(id);
    inc.rootCause = input.rootCause;
    inc.solution = input.solution;
    inc.preventiveActions = input.preventiveActions ?? [];
    inc.lesson = input.lesson ?? null;
    inc.status = 'RESOLVED';
    inc.resolvedAt = nowIso();
    inc.updatedAt = nowIso();
    return inc;
  }

  search(query: string): Incident[] {
    const tokens = tokenize(query);
    return this.incidents
      .map((i) => ({
        i,
        score: scoreIncident(i, tokens),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.i);
  }

  private require(id: string): Incident {
    const inc = this.get(id);
    if (!inc) throw new Error(`Unknown incident: ${id}`);
    return inc;
  }
}

function inferSeverity(title: string, description: string): IncidentSeverity {
  const t = `${title} ${description}`.toLowerCase();
  if (/data loss|security|breach|payment.*fail|critical|prod down/.test(t)) return 'CRITICAL';
  if (/500|crash|outage|timeout|logout|auth/.test(t)) return 'HIGH';
  if (/bug|error|fail|broken/.test(t)) return 'MEDIUM';
  return 'LOW';
}

function inferModules(title: string, description: string): string[] {
  const t = `${title} ${description}`.toLowerCase();
  const mods = new Set<string>();
  if (/auth|jwt|login|logout|token/.test(t)) mods.add('Auth');
  if (/payment|refund|billing|stripe/.test(t)) mods.add('Payment');
  if (/user|profile/.test(t)) mods.add('Users');
  if (/db|database|migration|prisma|sql/.test(t)) mods.add('Database');
  if (/notif/.test(t)) mods.add('Notifications');
  if (/api|endpoint|route/.test(t)) mods.add('API');
  if (!mods.size) mods.add('Core');
  return [...mods];
}

function signatureFrom(title: string, description: string): string {
  return tokenize(`${title} ${description}`).slice(0, 8).join('|');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
    .slice(0, 40);
}

function scoreIncident(i: Incident, tokens: string[]): number {
  const hay = `${i.title} ${i.description} ${i.rootCause ?? ''} ${i.solution ?? ''} ${i.affectedModules.join(' ')}`.toLowerCase();
  let s = 0;
  for (const t of tokens) if (hay.includes(t)) s += 1;
  return s;
}

export function createIncidentRegistry(): IncidentRegistry {
  return new IncidentRegistry();
}
