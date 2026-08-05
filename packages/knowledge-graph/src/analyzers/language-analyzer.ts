export interface ImportRef {
  /** Specifier as written in source (./foo, @scope/pkg, …) */
  specifier: string;
  /** Resolved relative path when local, else undefined */
  resolvedPath?: string;
  isExternal: boolean;
  line?: number;
}

export interface ExportSymbol {
  name: string;
  kind: 'function' | 'class' | 'const' | 'type' | 'default' | 'unknown';
  line?: number;
}

export interface LanguageAnalysis {
  language: string;
  filePath: string;
  imports: ImportRef[];
  exports: ExportSymbol[];
  hints: {
    isService?: boolean;
    isComponent?: boolean;
    isApiEndpoint?: boolean;
    tableNames?: string[];
  };
}

/**
 * Pluggable per-language analyzer. MVP implements TypeScript basics;
 * PHP / Python / Java ship as stubs for extension.
 */
export interface LanguageAnalyzer {
  readonly language: string;
  /** Extensions this analyzer handles, e.g. ['.ts', '.tsx'] */
  readonly extensions: string[];
  analyze(filePath: string, source: string): LanguageAnalysis;
}

export function pickAnalyzer(
  analyzers: LanguageAnalyzer[],
  filePath: string,
): LanguageAnalyzer | undefined {
  const lower = filePath.toLowerCase();
  return analyzers.find((a) => a.extensions.some((ext) => lower.endsWith(ext)));
}
