import type { FocusContext } from '../types.js';

/**
 * Limit Cursor context to the active technical area.
 */
export class FocusManager {
  focus(input: {
    area: string;
    modules?: string[];
    relatedFiles?: string[];
  }): FocusContext {
    const area = input.area.trim() || 'Core';
    const allowed = unique([
      area,
      ...(input.modules ?? inferModules(area)),
    ]);

    return {
      area,
      allowedModules: allowed,
      relatedFiles: input.relatedFiles ?? [],
      excludedHint: `Prefer ${allowed.join(', ')} — not the entire project.`,
    };
  }

  /** Filter paths to those matching focus modules/area */
  filterFiles(focus: FocusContext, files: string[]): string[] {
    const keys = focus.allowedModules.map((m) => m.toLowerCase());
    const area = focus.area.toLowerCase();
    return files.filter((f) => {
      const p = f.toLowerCase();
      return keys.some((k) => p.includes(k)) || p.includes(area);
    });
  }
}

function inferModules(area: string): string[] {
  const a = area.toLowerCase();
  const mods = new Set<string>();
  if (/payment|refund|billing|checkout/.test(a)) {
    mods.add('Payment');
    mods.add('Transactions');
    mods.add('Users');
  } else if (/auth|login|session/.test(a)) {
    mods.add('Auth');
    mods.add('Users');
  } else if (/search|catalog|product/.test(a)) {
    mods.add('Catalog');
    mods.add('Search');
  } else {
    mods.add(area);
  }
  return [...mods];
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((i) => i.trim()).filter(Boolean))];
}

export function createFocusManager(): FocusManager {
  return new FocusManager();
}
