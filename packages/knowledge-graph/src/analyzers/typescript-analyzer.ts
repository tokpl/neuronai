import type {
  ExportSymbol,
  ImportRef,
  LanguageAnalysis,
  LanguageAnalyzer,
} from './language-analyzer.js';

/**
 * Lightweight TypeScript/JavaScript analyzer (regex-based MVP - no full TS compiler).
 */
export class TypeScriptAnalyzer implements LanguageAnalyzer {
  readonly language = 'typescript';
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  analyze(filePath: string, source: string): LanguageAnalysis {
    const imports: ImportRef[] = [];
    const exports: ExportSymbol[] = [];

    const importRe =
      /(?:import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+|require\s*\(\s*|export\s+(?:type\s+)?[\s\S]*?\s+from\s+)['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source)) !== null) {
      const specifier = match[1] ?? '';
      const isExternal = !specifier.startsWith('.') && !specifier.startsWith('/');
      imports.push({
        specifier,
        resolvedPath: isExternal ? undefined : specifier,
        isExternal,
      });
    }

    // also catch: import 'side-effect'
    const sideRe = /import\s+['"]([^'"]+)['"]/g;
    while ((match = sideRe.exec(source)) !== null) {
      const specifier = match[1] ?? '';
      if (!imports.some((i) => i.specifier === specifier)) {
        imports.push({
          specifier,
          isExternal: !specifier.startsWith('.'),
          resolvedPath: specifier.startsWith('.') ? specifier : undefined,
        });
      }
    }

    const exportFn = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
    while ((match = exportFn.exec(source)) !== null) {
      exports.push({ name: match[1]!, kind: 'function' });
    }
    const exportClass = /export\s+(?:default\s+)?class\s+([A-Za-z0-9_]+)/g;
    while ((match = exportClass.exec(source)) !== null) {
      exports.push({ name: match[1]!, kind: 'class' });
    }
    const exportConst = /export\s+const\s+([A-Za-z0-9_]+)/g;
    while ((match = exportConst.exec(source)) !== null) {
      exports.push({ name: match[1]!, kind: 'const' });
    }
    if (/export\s+default\b/.test(source)) {
      exports.push({ name: 'default', kind: 'default' });
    }

    const base = filePath.replace(/\\/g, '/').toLowerCase();
    const hints = {
      isService: /service|controller|gateway|repository/i.test(base) || /Service\b/.test(source),
      isComponent: /\.(tsx|jsx)$/.test(base) || /from ['"]react['"]/.test(source),
      isApiEndpoint:
        /route\.(ts|js)$|api\//i.test(base) ||
        /(?:app|router)\.(get|post|put|patch|delete)\(/.test(source),
      tableNames: extractTableHints(source),
    };

    return { language: this.language, filePath, imports, exports, hints };
  }
}

function extractTableHints(source: string): string[] {
  const tables = new Set<string>();
  const pg = /(?:from|join|into|update)\s+["`]?([a-z_][a-z0-9_]*)["`]?/gi;
  let m: RegExpExecArray | null;
  while ((m = pg.exec(source)) !== null) {
    const name = m[1]!;
    if (!['select', 'where', 'and', 'or', 'as', 'on', 'set'].includes(name.toLowerCase())) {
      tables.add(name);
    }
  }
  return [...tables].slice(0, 20);
}

export function createTypeScriptAnalyzer(): TypeScriptAnalyzer {
  return new TypeScriptAnalyzer();
}
