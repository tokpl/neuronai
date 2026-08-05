export interface MinedPattern {
  name: string;
  kind: 'service_module' | 'repository' | 'hook' | 'naming' | 'generic';
  count: number;
  examples: string[];
  summary: string;
}

/**
 * Detect repeated architecture / naming conventions from file or symbol names.
 */
export class PatternMiner {
  mine(names: string[]): MinedPattern[] {
    const patterns: MinedPattern[] = [];

    const services = names.filter((n) => /Service$/i.test(base(n)));
    if (services.length >= 3) {
      patterns.push({
        name: 'service-oriented modules',
        kind: 'service_module',
        count: services.length,
        examples: services.slice(0, 12).map(base),
        summary: `Project follows service-oriented module pattern (${services.length} *Service).`,
      });
    }

    const repos = names.filter((n) => /Repository$/i.test(base(n)));
    if (repos.length >= 2) {
      patterns.push({
        name: 'repository layer',
        kind: 'repository',
        count: repos.length,
        examples: repos.slice(0, 12).map(base),
        summary: `Repository pattern detected (${repos.length} *Repository).`,
      });
    }

    const hooks = names.filter((n) => /^use[A-Z]/.test(base(n)));
    if (hooks.length >= 4) {
      patterns.push({
        name: 'react-style hooks',
        kind: 'hook',
        count: hooks.length,
        examples: hooks.slice(0, 12).map(base),
        summary: `Hook naming convention (useX) appears ${hooks.length} times.`,
      });
    }

    const camelFiles = names.filter((n) => /[a-z][A-Z]/.test(base(n)));
    if (camelFiles.length >= 8 && camelFiles.length / Math.max(names.length, 1) > 0.4) {
      patterns.push({
        name: 'camelCase / PascalCase identifiers',
        kind: 'naming',
        count: camelFiles.length,
        examples: camelFiles.slice(0, 8).map(base),
        summary: 'Naming leans toward camelCase/PascalCase identifiers.',
      });
    }

    return patterns;
  }
}

function base(pathOrName: string): string {
  const part = pathOrName.split(/[/\\]/).pop() ?? pathOrName;
  return part.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/i, '');
}

export function createPatternMiner(): PatternMiner {
  return new PatternMiner();
}
