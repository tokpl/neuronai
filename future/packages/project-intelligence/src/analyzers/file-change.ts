import { createChangeImportanceAnalyzer } from './importance.js';
import type { FileChangeInsight, ProjectEvent } from '../types.js';

/**
 * Interpret file changes: what / why / impact — not just "file changed".
 */
export class FileChangeAnalyzer {
  private readonly importance = createChangeImportanceAnalyzer();

  analyze(event: ProjectEvent): FileChangeInsight | null {
    if (!event.path) return null;
    if (!['FILE_CREATED', 'FILE_CHANGED', 'FILE_DELETED'].includes(event.type)) return null;

    const path = event.path.replace(/\\/g, '/');
    const base = path.split('/').pop() ?? path;
    const moduleHints = inferModules(path, base);
    const domain = inferDomain(path, base);
    const importance = this.importance.classify(path, event.detail);

    const summary =
      event.type === 'FILE_DELETED'
        ? `${domain} removed (${base})`
        : event.type === 'FILE_CREATED'
          ? `${domain} added (${base})`
          : `${domain} changed (${base})`;

    const why =
      event.detail?.trim() ||
      (event.type === 'FILE_DELETED'
        ? 'File deleted — may remove a capability or leave stale imports'
        : 'Source edit detected — review for architecture / memory impact');

    const affected = inferAffected(domain, moduleHints);

    return {
      path,
      summary,
      why,
      affected,
      importance,
      moduleHints,
    };
  }
}

function inferDomain(path: string, base: string): string {
  if (/auth/i.test(path) || /auth/i.test(base)) return 'Authentication logic';
  if (/payment|refund|billing/i.test(path)) return 'Payment logic';
  if (/permission|rbac|acl/i.test(path)) return 'Permissions logic';
  if (/notif/i.test(path)) return 'Notification logic';
  if (/schema\.prisma|migration/i.test(path)) return 'Database schema';
  if (/controller/i.test(base)) return 'Controller / API layer';
  if (/service/i.test(base)) return 'Service layer';
  if (/repository|repo\./i.test(base)) return 'Repository / data layer';
  return 'Project code';
}

function inferModules(path: string, base: string): string[] {
  const mods = new Set<string>();
  const parts = path.split('/');
  if (parts[0] === 'packages' || parts[0] === 'apps') {
    if (parts[1]) mods.add(parts[1]);
  }
  const m = base.match(/^([A-Z][a-zA-Z]+)(Service|Controller|Repository)/);
  if (m) mods.add(m[1]!);
  if (/auth/i.test(path)) mods.add('Auth');
  if (/payment/i.test(path)) mods.add('Payment');
  return [...mods];
}

function inferAffected(domain: string, modules: string[]): string[] {
  const affected = new Set<string>(modules);
  if (/auth/i.test(domain)) {
    affected.add('Login flow');
    affected.add('Permissions');
    affected.add('API routes');
  }
  if (/payment/i.test(domain)) {
    affected.add('Transactions');
    affected.add('Notifications');
    affected.add('Ledger / outbox');
  }
  if (/permission/i.test(domain)) {
    affected.add('API routes');
    affected.add('Tenant scoping');
  }
  if (/database/i.test(domain)) {
    affected.add('Repositories');
    affected.add('Migrations');
  }
  return [...affected].slice(0, 8);
}

export function createFileChangeAnalyzer(): FileChangeAnalyzer {
  return new FileChangeAnalyzer();
}
