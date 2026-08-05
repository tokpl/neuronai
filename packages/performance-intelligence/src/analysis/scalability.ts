import type { ScalabilityWarning } from '../types.js';
import { newId } from '../types.js';

/**
 * Architectural scalability — coupling / boundaries (not runtime metrics).
 */
export class ScalabilityAnalyzer {
  analyze(input: {
    modules?: string[];
    dependencies?: Array<{ from: string; to: string }>;
    notes?: string[];
  }): ScalabilityWarning[] {
    const warnings: ScalabilityWarning[] = [];
    const deps = input.dependencies ?? inferDeps(input.notes ?? [], input.modules ?? []);

    for (const d of deps) {
      if (isCrossDomainTightCouple(d.from, d.to)) {
        warnings.push({
          id: newId('scale'),
          module: d.from,
          dependsOn: d.to,
          warning: `${d.from} module directly depends on ${d.to}.`,
          recommendation: recommendDecouple(d.from, d.to),
          severity: 'HIGH',
        });
      }
    }

    const modules = input.modules ?? [];
    if (modules.length >= 4) {
      const hub = findHub(deps);
      if (hub && hub.count >= 3) {
        warnings.push({
          id: newId('scale'),
          module: hub.name,
          dependsOn: 'many modules',
          warning: `${hub.name} appears as a high-coupling hub (${hub.count} edges).`,
          recommendation: 'Split responsibilities or introduce anti-corruption / facade boundaries.',
          severity: 'MEDIUM',
        });
      }
    }

    if (!warnings.length && modules.length) {
      warnings.push({
        id: newId('scale'),
        module: modules[0]!,
        dependsOn: '—',
        warning: 'No strong coupling anti-patterns detected from provided signals.',
        recommendation: 'Keep validating boundaries as the graph grows.',
        severity: 'LOW',
      });
    }

    return warnings;
  }
}

function inferDeps(
  notes: string[],
  modules: string[],
): Array<{ from: string; to: string }> {
  const deps: Array<{ from: string; to: string }> = [];
  const blob = notes.join('\n').toLowerCase();
  // Explicit "Payment depends on Notification" style
  const re = /(\w+)\s+(?:module\s+)?(?:directly\s+)?depends\s+on\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob))) {
    deps.push({ from: capitalize(m[1]!), to: capitalize(m[2]!) });
  }
  // Heuristic: payment→notification, auth→email, etc. when both modules exist
  const set = new Set(modules.map((x) => x.toLowerCase()));
  if (set.has('payment') && (set.has('notification') || set.has('notifications'))) {
    deps.push({ from: 'Payment', to: 'Notification' });
  }
  if (set.has('order') && set.has('email')) {
    deps.push({ from: 'Order', to: 'Email' });
  }
  return deps;
}

function isCrossDomainTightCouple(from: string, to: string): boolean {
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  const pairs: Array<[RegExp, RegExp]> = [
    [/payment|order|checkout/, /notif|email|sms|mail/],
    [/auth|user/, /billing|payment/],
    [/catalog|product/, /shipping|fulfill/],
  ];
  return pairs.some(([x, y]) => (x.test(a) && y.test(b)) || (x.test(b) && y.test(a)));
}

function recommendDecouple(from: string, to: string): string {
  return `Decouple ${from} from ${to}: use event communication (outbox/message bus) instead of a direct call.`;
}

function findHub(deps: Array<{ from: string; to: string }>): { name: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const d of deps) {
    counts.set(d.from, (counts.get(d.from) ?? 0) + 1);
    counts.set(d.to, (counts.get(d.to) ?? 0) + 1);
  }
  let best: { name: string; count: number } | null = null;
  for (const [name, count] of counts) {
    if (!best || count > best.count) best = { name, count };
  }
  return best;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function createScalabilityAnalyzer(): ScalabilityAnalyzer {
  return new ScalabilityAnalyzer();
}
