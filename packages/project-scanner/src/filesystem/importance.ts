import type { FileImportance } from '../types.js';

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'vendor',
  '.git',
  '.next',
  '.nuxt',
  'coverage',
  'target',
  '__pycache__',
  '.turbo',
  '.cache',
  'out',
]);

const HIGH_SEGMENTS = [
  'src',
  'app',
  'apps',
  'packages',
  'components',
  'services',
  'modules',
  'lib',
  'server',
  'api',
  'backend',
  'frontend',
];

const MEDIUM_SEGMENTS = ['config', 'configs', 'test', 'tests', 'docs', 'documentation', 'scripts'];

export class FileImportanceAnalyzer {
  isIgnoredDir(name: string): boolean {
    return IGNORE_DIRS.has(name) || name.startsWith('.');
  }

  classify(relativePath: string): FileImportance {
    const parts = relativePath.replace(/\\/g, '/').toLowerCase().split('/');
    if (parts.some((p) => IGNORE_DIRS.has(p))) return 'IGNORE';
    if (HIGH_SEGMENTS.some((s) => parts.includes(s))) return 'HIGH';
    if (MEDIUM_SEGMENTS.some((s) => parts.includes(s))) return 'MEDIUM';
    if (/\.(md|json|ya?ml|toml|lock)$/i.test(relativePath)) return 'MEDIUM';
    if (/\.(ts|tsx|js|jsx|py|php|java|go|rs)$/i.test(relativePath)) return 'HIGH';
    return 'MEDIUM';
  }
}

export function createFileImportanceAnalyzer(): FileImportanceAnalyzer {
  return new FileImportanceAnalyzer();
}
