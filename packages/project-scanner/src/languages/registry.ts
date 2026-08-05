import type { SupportedLanguage } from '../types.js';

const EXT_LANG: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.php': 'php',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
};

/**
 * Extensible language registry - add new extensions here.
 */
export class LanguageRegistry {
  detect(relativePath: string): SupportedLanguage {
    const lower = relativePath.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) return 'unknown';
    return EXT_LANG[lower.slice(dot)] ?? 'unknown';
  }

  supported(): SupportedLanguage[] {
    return ['javascript', 'typescript', 'python', 'php', 'java', 'go', 'rust'];
  }
}

export function createLanguageRegistry(): LanguageRegistry {
  return new LanguageRegistry();
}
