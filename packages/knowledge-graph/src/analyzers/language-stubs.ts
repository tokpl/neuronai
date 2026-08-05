import type { LanguageAnalysis, LanguageAnalyzer } from './language-analyzer.js';

/** Stub — ready for PHP AST / tokenizer later. */
export class PHPAnalyzer implements LanguageAnalyzer {
  readonly language = 'php';
  readonly extensions = ['.php'];

  analyze(filePath: string, source: string): LanguageAnalysis {
    const imports: LanguageAnalysis['imports'] = [];
    const useRe = /use\s+([A-Za-z0-9_\\]+)\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = useRe.exec(source)) !== null) {
      imports.push({ specifier: m[1]!, isExternal: true });
    }
    return {
      language: this.language,
      filePath,
      imports,
      exports: [],
      hints: { isService: /Service\.php$/i.test(filePath) },
    };
  }
}

/** Stub — Python import discovery basics. */
export class PythonAnalyzer implements LanguageAnalyzer {
  readonly language = 'python';
  readonly extensions = ['.py'];

  analyze(filePath: string, source: string): LanguageAnalysis {
    const imports: LanguageAnalysis['imports'] = [];
    const re = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const specifier = m[1] ?? m[2] ?? '';
      imports.push({
        specifier,
        isExternal: !specifier.startsWith('.'),
      });
    }
    return {
      language: this.language,
      filePath,
      imports,
      exports: [],
      hints: {},
    };
  }
}

/** Stub — Java import basics. */
export class JavaAnalyzer implements LanguageAnalyzer {
  readonly language = 'java';
  readonly extensions = ['.java'];

  analyze(filePath: string, source: string): LanguageAnalysis {
    const imports: LanguageAnalysis['imports'] = [];
    const re = /import\s+([A-Za-z0-9_.]+)\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      imports.push({ specifier: m[1]!, isExternal: true });
    }
    return {
      language: this.language,
      filePath,
      imports,
      exports: [],
      hints: { isService: /Service\.java$/i.test(filePath) },
    };
  }
}
