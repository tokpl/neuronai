import type { ThreatModel, ThreatRisk, SecuritySeverity } from '../types.js';
import { nowIso } from '../types.js';

/**
 * Lightweight threat model from architecture signals — advisory only.
 */
export class ThreatModelGenerator {
  generate(input: {
    modules?: string[];
    architectureNotes?: string[];
    entryPoints?: string[];
    assets?: string[];
  }): ThreatModel {
    const notes = (input.architectureNotes ?? []).join('\n').toLowerCase();
    const modules = input.modules ?? inferModules(notes);

    const assets = (input.assets?.length
      ? input.assets
      : ['User data', 'Authentication credentials', 'Business configuration']
    ).map((name) => ({
      name,
      description: describeAsset(name),
    }));

    const entryPoints = (input.entryPoints?.length
      ? input.entryPoints
      : defaultEntryPoints(notes, modules)
    ).map((name) => ({
      name,
      description: `External or privileged entry: ${name}`,
    }));

    const trustBoundaries = [
      { name: 'Client ↔ API', description: 'Untrusted clients call public HTTP/API surface' },
      { name: 'API ↔ Database', description: 'Server-side data access behind application logic' },
      {
        name: 'App ↔ Third parties',
        description: 'Payments, email, OAuth providers — external trust',
      },
    ];

    const risks: ThreatRisk[] = [];
    for (const asset of assets) {
      for (const ep of entryPoints) {
        risks.push({
          asset: asset.name,
          entryPoint: ep.name,
          risk: riskText(asset.name, ep.name),
          severity: riskSeverity(asset.name, ep.name, notes),
        });
      }
    }

    // Cap noise
    const trimmed = risks
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
      .slice(0, 12);

    return {
      assets,
      entryPoints,
      trustBoundaries,
      risks: trimmed,
      generatedAt: nowIso(),
    };
  }
}

function inferModules(notes: string): string[] {
  const mods = new Set<string>();
  if (/auth|jwt|login/.test(notes)) mods.add('Auth');
  if (/payment|stripe|billing/.test(notes)) mods.add('Payment');
  if (/admin/.test(notes)) mods.add('Admin');
  if (/user|profile/.test(notes)) mods.add('Users');
  if (/api|http|graphql/.test(notes)) mods.add('API');
  if (!mods.size) mods.add('Core');
  return [...mods];
}

function defaultEntryPoints(notes: string, modules: string[]): string[] {
  const eps = new Set<string>(['API']);
  if (modules.includes('Admin') || /admin/.test(notes)) eps.add('Admin UI');
  if (/webhook|stripe/.test(notes) || modules.includes('Payment')) eps.add('Webhooks');
  if (/cli|worker|cron/.test(notes)) eps.add('Background jobs');
  return [...eps];
}

function describeAsset(name: string): string {
  if (/user/i.test(name)) return 'PII / account records requiring confidentiality & integrity';
  if (/auth|credential/i.test(name)) return 'Tokens, passwords, session material';
  if (/payment|money/i.test(name)) return 'Payment instruments and transaction records';
  return `Sensitive asset: ${name}`;
}

function riskText(asset: string, entry: string): string {
  if (/admin/i.test(entry)) return `Unauthorized admin access to ${asset}`;
  if (/webhook/i.test(entry)) return `Forged webhook affecting ${asset}`;
  return `Unauthorized access to ${asset} via ${entry}`;
}

function riskSeverity(asset: string, entry: string, notes: string): SecuritySeverity {
  if (/credential|payment/i.test(asset) || /admin/i.test(entry)) return 'HIGH';
  if (/webhook/i.test(entry) && /payment|stripe/.test(notes)) return 'HIGH';
  if (/user data/i.test(asset)) return 'MEDIUM';
  return 'MEDIUM';
}

function sevRank(s: SecuritySeverity): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[s];
}

export function createThreatModelGenerator(): ThreatModelGenerator {
  return new ThreatModelGenerator();
}
