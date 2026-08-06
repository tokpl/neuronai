import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

import {
  emptyCodeIntelligence,
  symbolId,
  type CodeEdge,
  type CodeFileNode,
  type CodeIntelligence,
  type CodeSymbolNode,
  type RelationConfidence,
} from '@neuronai/types';

import type { ScannedFile } from '../types.js';

const MAX_FILE_CHARS = 80_000;
const MAX_FILES = 250;
const MAX_SYMBOLS = 4_000;
const MAX_EDGES = 8_000;

interface LocalImport {
  /** Local binding in this file (default or named). */
  binding: string;
  /** Resolved repo-relative path, or null if unresolved / external. */
  resolved: string | null;
  /** Named export pulled from the module (`import { X as Y }` → X). */
  importedName?: string;
  isNamespace?: boolean;
  isDefault?: boolean;
}

interface FileParse {
  path: string;
  role?: string;
  imports: LocalImport[];
  /** Local vars constructed from an imported class: `const billing = new BillingService()`. */
  instanceAliases: Array<{ local: string; classBinding: string }>;
  symbols: CodeSymbolNode[];
  exports: string[];
  routes: Array<{ method: string; routePath: string; handler?: string }>;
  memberCalls: Array<{ binding: string; member: string; detail: string }>;
  directCalls: Array<{ binding: string; detail: string }>;
  extendsOf: Array<{ name: string; base: string }>;
  implementsOf: Array<{ name: string; iface: string }>;
}

/**
 * Build compact, trustworthy code intelligence for TS/JS focus files.
 * Missing an edge is better than inventing one.
 */
export async function buildCodeIntelligence(
  files: ScannedFile[],
  options: { maxFiles?: number; concurrency?: number; allPaths?: Set<string> } = {},
): Promise<CodeIntelligence> {
  const candidates = files
    .filter(
      (f) =>
        f.importance === 'HIGH' &&
        (f.language === 'typescript' || f.language === 'javascript'),
    )
    .slice(0, options.maxFiles ?? MAX_FILES);

  const pathIndex = options.allPaths ?? new Set(files.map((f) => norm(f.relativePath)));
  const concurrency = options.concurrency ?? 16;
  const parses: FileParse[] = [];

  for (let i = 0; i < candidates.length; i += concurrency) {
    const batch = candidates.slice(i, i + concurrency);
    const texts = await Promise.all(
      batch.map(async (f) => {
        try {
          const raw = await readFile(f.absolutePath, 'utf8');
          return { file: f, text: raw.slice(0, MAX_FILE_CHARS) };
        } catch {
          return null;
        }
      }),
    );
    for (const item of texts) {
      if (!item) continue;
      parses.push(parseFile(norm(item.file.relativePath), item.text, pathIndex));
    }
  }

  return linkParses(parses);
}

function linkParses(parses: FileParse[]): CodeIntelligence {
  const files: CodeFileNode[] = [];
  const symbols: CodeSymbolNode[] = [];
  const edges: CodeEdge[] = [];
  const exportIndex = new Map<string, CodeSymbolNode[]>(); // path → exported symbols
  const byId = new Map<string, CodeSymbolNode>();

  for (const p of parses) {
    const resolvedImports = [
      ...new Set(p.imports.map((i) => i.resolved).filter((x): x is string => Boolean(x))),
    ];
    files.push({
      path: p.path,
      role: p.role,
      imports: resolvedImports,
      exports: p.exports,
      concepts: conceptsFrom(p.path, p.exports.join(' ')),
      summary: summarizeFile(p),
    });

    for (const sym of p.symbols) {
      symbols.push(sym);
      byId.set(sym.id, sym);
      if (sym.exported) {
        const list = exportIndex.get(p.path) ?? [];
        list.push(sym);
        exportIndex.set(p.path, list);
      }
      edges.push({
        from: sym.id,
        to: p.path,
        type: 'DEFINED_IN',
        confidence: 'high',
        evidence: { kind: 'structure', detail: `${sym.name} is defined in ${p.path}` },
      });
      if (p.role) {
        edges.push({
          from: sym.id,
          to: p.path,
          type: 'BELONGS_TO',
          confidence: 'high',
          evidence: { kind: 'structure', detail: `file role ${p.role}` },
        });
      }
    }

    for (const target of resolvedImports) {
      edges.push({
        from: p.path,
        to: target,
        type: 'IMPORTS',
        confidence: 'high',
        evidence: {
          kind: 'import',
          detail: `${p.path} imports ${target}`,
        },
      });
    }

    for (const name of p.exports) {
      const id = symbolId(p.path, name);
      edges.push({
        from: p.path,
        to: id,
        type: 'EXPORTS',
        confidence: 'high',
        evidence: { kind: 'export', detail: `${p.path} exports ${name}` },
      });
    }
  }

  // CALLS — only when the callee resolves uniquely through a local import.
  for (const p of parses) {
    const importByBinding = new Map(p.imports.map((i) => [i.binding, i]));

    for (const call of p.memberCalls) {
      let binding = call.binding;
      const alias = p.instanceAliases.find((a) => a.local === binding);
      if (alias) binding = alias.classBinding;
      const imp = importByBinding.get(binding);
      if (!imp?.resolved) continue;
      const targets = (exportIndex.get(imp.resolved) ?? []).filter(
        (s) =>
          s.name === call.member ||
          (imp.isDefault && s.kind === 'class' && call.member.length > 0) ||
          (s.kind === 'class' && s.name === call.binding),
      );

      // Prefer Class.method when Class was default-imported and method exists on that class
      let callee: CodeSymbolNode | undefined;
      if (imp.isDefault || imp.isNamespace) {
        const classes = (exportIndex.get(imp.resolved) ?? []).filter((s) => s.kind === 'class');
        if (classes.length === 1) {
          const methodId = symbolId(imp.resolved, call.member, classes[0]!.name);
          callee = byId.get(methodId);
          // Also accept top-level exported function with that name in the module
          if (!callee) {
            const fns = (exportIndex.get(imp.resolved) ?? []).filter(
              (s) => s.name === call.member && !s.parent,
            );
            if (fns.length === 1) callee = fns[0];
          }
        } else {
          const fns = (exportIndex.get(imp.resolved) ?? []).filter(
            (s) => s.name === call.member && !s.parent,
          );
          if (fns.length === 1) callee = fns[0];
        }
      } else if (imp.importedName) {
        // import { BillingService as BS } → BS.createInvoice(
        const classSym = (exportIndex.get(imp.resolved) ?? []).find(
          (s) => s.name === imp.importedName && s.kind === 'class',
        );
        if (classSym) {
          callee = byId.get(symbolId(imp.resolved, call.member, classSym.name));
        }
        if (!callee && targets.length === 1) callee = targets[0];
      }

      if (!callee) continue;
      edges.push({
        from: p.path,
        to: callee.id,
        type: 'CALLS',
        confidence: confidenceForCall(imp),
        evidence: { kind: 'call', detail: call.detail },
      });
    }

    for (const call of p.directCalls) {
      const imp = importByBinding.get(call.binding);
      if (!imp?.resolved || !imp.importedName) continue;
      const matches = (exportIndex.get(imp.resolved) ?? []).filter(
        (s) => s.name === imp.importedName && !s.parent,
      );
      if (matches.length !== 1) continue;
      edges.push({
        from: p.path,
        to: matches[0]!.id,
        type: 'CALLS',
        confidence: 'high',
        evidence: { kind: 'call', detail: call.detail },
      });
    }

    // ROUTE_TO — only when handler binding maps to a same-file symbol or a verified CALLS target.
    for (const route of p.routes) {
      const routeSymId = symbolId(p.path, `${route.method} ${route.routePath}`);
      if (!byId.has(routeSymId)) {
        const routeSym: CodeSymbolNode = {
          id: routeSymId,
          name: `${route.method} ${route.routePath}`,
          kind: 'route',
          path: p.path,
          role: 'route',
          exported: true,
          concepts: conceptsFrom(route.routePath, route.method),
          summary: `HTTP ${route.method} ${route.routePath}`,
        };
        symbols.push(routeSym);
        byId.set(routeSymId, routeSym);
      }

      if (!route.handler) continue;
      const local = p.symbols.find((s) => s.name === route.handler && !s.parent);
      if (local) {
        edges.push({
          from: routeSymId,
          to: local.id,
          type: 'ROUTE_TO',
          confidence: 'high',
          evidence: {
            kind: 'route',
            detail: `${route.method} ${route.routePath} → ${route.handler}`,
          },
        });
        continue;
      }

      // handler is an imported binding used as Express middleware reference
      const imp = importByBinding.get(route.handler);
      if (imp?.resolved && imp.importedName) {
        const matches = (exportIndex.get(imp.resolved) ?? []).filter(
          (s) => s.name === imp.importedName && !s.parent,
        );
        if (matches.length === 1) {
          edges.push({
            from: routeSymId,
            to: matches[0]!.id,
            type: 'ROUTE_TO',
            confidence: 'medium',
            evidence: {
              kind: 'route',
              detail: `${route.method} ${route.routePath} handler ${route.handler} from ${imp.resolved}`,
            },
          });
        }
      }
    }

    for (const ex of p.extendsOf) {
      const child = byId.get(symbolId(p.path, ex.name));
      if (!child) continue;
      const base = resolveImportedSymbol(p, ex.base, exportIndex);
      if (!base) continue;
      edges.push({
        from: child.id,
        to: base.id,
        type: 'EXTENDS',
        confidence: 'high',
        evidence: { kind: 'extends', detail: `${ex.name} extends ${ex.base}` },
      });
    }

    for (const im of p.implementsOf) {
      const child = byId.get(symbolId(p.path, im.name));
      if (!child) continue;
      const iface = resolveImportedSymbol(p, im.iface, exportIndex);
      if (!iface) continue;
      edges.push({
        from: child.id,
        to: iface.id,
        type: 'IMPLEMENTS',
        confidence: 'high',
        evidence: { kind: 'implements', detail: `${im.name} implements ${im.iface}` },
      });
    }
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    files: files.slice(0, MAX_FILES),
    symbols: prioritizeSymbols(symbols).slice(0, MAX_SYMBOLS),
    edges: prioritizeEdges(edges).slice(0, MAX_EDGES),
  };
}

function confidenceForCall(imp: LocalImport): RelationConfidence {
  if (imp.importedName && !imp.isDefault && !imp.isNamespace) return 'high';
  if (imp.isDefault) return 'medium';
  return 'medium';
}

function resolveImportedSymbol(
  parse: FileParse,
  name: string,
  exportIndex: Map<string, CodeSymbolNode[]>,
): CodeSymbolNode | undefined {
  const local = parse.symbols.find((s) => s.name === name && !s.parent);
  if (local) return local;
  const imp = parse.imports.find((i) => i.binding === name || i.importedName === name);
  if (!imp?.resolved) return undefined;
  const matches = (exportIndex.get(imp.resolved) ?? []).filter(
    (s) => s.name === (imp.importedName ?? name) && !s.parent,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function parseFile(path: string, text: string, pathIndex: Set<string>): FileParse {
  const role = inferRole(path);
  const imports = parseImports(path, text, pathIndex);
  const symbols: CodeSymbolNode[] = [];
  const exports: string[] = [];

  for (const m of text.matchAll(
    /export\s+(?:async\s+)?(?:function|class|const|let|type|interface)\s+(\w+)/g,
  )) {
    const name = m[1]!;
    const kind = kindFromExportMatch(m[0]!);
    exports.push(name);
    symbols.push({
      id: symbolId(path, name),
      name,
      kind,
      path,
      role,
      exported: true,
      concepts: conceptsFrom(name, path),
      summary: `${kind} ${name}`,
    });
  }

  // Class methods: only inside exported classes we already found (heuristic block scan)
  for (const cls of [...symbols.filter((s) => s.kind === 'class')]) {
    const classRe = new RegExp(
      `export\\s+class\\s+${cls.name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`,
      'm',
    );
    const block = classRe.exec(text);
    if (!block?.[1]) continue;
    for (const mm of block[1].matchAll(
      /(?:(?:public|private|protected|static|async)\s+)*(\w+)\s*\([^)]*\)\s*\{/g,
    )) {
      const method = mm[1]!;
      if (method === 'constructor' || method.length < 2) continue;
      if (/^(if|for|while|switch|catch|return)$/.test(method)) continue;
      symbols.push({
        id: symbolId(path, method, cls.name),
        name: method,
        kind: 'method',
        path,
        parent: cls.name,
        role,
        exported: true,
        concepts: conceptsFrom(method, cls.name, path),
        summary: `${cls.name}.${method}()`,
      });
    }
  }

  const routes: FileParse['routes'] = [];
  for (const m of text.matchAll(
    /\b(?:app|router|server)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z_][\w]*)/gi,
  )) {
    routes.push({
      method: m[1]!.toUpperCase(),
      routePath: m[2]!,
      handler: m[3],
    });
  }
  // Route without capturing handler binding (path only) — still register route symbol later
  for (const m of text.matchAll(
    /\b(?:app|router|server)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/gi,
  )) {
    const method = m[1]!.toUpperCase();
    const routePath = m[2]!;
    if (!routes.some((r) => r.method === method && r.routePath === routePath)) {
      routes.push({ method, routePath });
    }
  }

  const memberCalls: FileParse['memberCalls'] = [];
  const importBindings = new Set(imports.map((i) => i.binding));
  const instanceAliases: FileParse['instanceAliases'] = [];
  for (const m of text.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*new\s+(\w+)\s*\(/g)) {
    const local = m[1]!;
    const classBinding = m[2]!;
    if (importBindings.has(classBinding)) {
      instanceAliases.push({ local, classBinding });
      importBindings.add(local); // allow member calls on the instance
    }
  }
  for (const m of text.matchAll(/\b([A-Za-z_][\w]*)\.([a-zA-Z_][\w]*)\s*\(/g)) {
    const binding = m[1]!;
    const member = m[2]!;
    if (/^(Math|console|JSON|Object|Array|Promise|Buffer|process|Error|this)$/.test(binding)) continue;
    // Only attribute member calls to known local import bindings / instances.
    if (!importBindings.has(binding)) continue;
    memberCalls.push({
      binding,
      member,
      detail: `${path} calls ${binding}.${member}()`,
    });
  }

  const directCalls: FileParse['directCalls'] = [];
  for (const m of text.matchAll(/\b([a-z][\w]*)\s*\(/g)) {
    const binding = m[1]!;
    if (
      /^(if|for|while|switch|catch|return|await|typeof|new|import|require|describe|it|test|expect)$/.test(
        binding,
      )
    ) {
      continue;
    }
    // Only keep if this binding is a named import (checked later)
    if (imports.some((i) => i.binding === binding && i.importedName)) {
      directCalls.push({ binding, detail: `${path} calls ${binding}()` });
    }
  }

  const extendsOf: FileParse['extendsOf'] = [];
  for (const m of text.matchAll(/export\s+class\s+(\w+)\s+extends\s+(\w+)/g)) {
    extendsOf.push({ name: m[1]!, base: m[2]! });
  }
  const implementsOf: FileParse['implementsOf'] = [];
  for (const m of text.matchAll(/export\s+class\s+(\w+)[^{]*\bimplements\s+([\w,\s]+)/g)) {
    for (const iface of m[2]!.split(',').map((s) => s.trim()).filter(Boolean)) {
      implementsOf.push({ name: m[1]!, iface });
    }
  }

  return {
    path,
    role,
    imports,
    instanceAliases,
    symbols,
    exports: [...new Set(exports)],
    routes,
    memberCalls,
    directCalls,
    extendsOf,
    implementsOf,
  };
}

function parseImports(fromPath: string, text: string, pathIndex: Set<string>): LocalImport[] {
  const out: LocalImport[] = [];
  const fromDir = dirname(fromPath);

  // import X from './y'
  for (const m of text.matchAll(
    /import\s+(\w+)\s+from\s+['"](\.\.?\/[^'"]+)['"]/g,
  )) {
    out.push({
      binding: m[1]!,
      resolved: resolveImport(fromDir, m[2]!, pathIndex),
      isDefault: true,
    });
  }

  // import * as X from './y'
  for (const m of text.matchAll(
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"](\.\.?\/[^'"]+)['"]/g,
  )) {
    out.push({
      binding: m[1]!,
      resolved: resolveImport(fromDir, m[2]!, pathIndex),
      isNamespace: true,
    });
  }

  // import { A, B as C } from './y'
  for (const m of text.matchAll(
    /import\s+\{([^}]+)\}\s+from\s+['"](\.\.?\/[^'"]+)['"]/g,
  )) {
    const resolved = resolveImport(fromDir, m[2]!, pathIndex);
    for (const part of m[1]!.split(',')) {
      const bit = part.trim();
      if (!bit) continue;
      const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(bit);
      if (asMatch) {
        out.push({
          binding: asMatch[2]!,
          importedName: asMatch[1]!,
          resolved,
        });
      } else if (/^\w+$/.test(bit)) {
        out.push({ binding: bit, importedName: bit, resolved });
      }
    }
  }

  // require('./y') assigned — skip; too ambiguous for trustworthy CALLS

  return out.filter((i) => i.resolved);
}

function resolveImport(
  fromDir: string,
  spec: string,
  pathIndex: Set<string>,
): string | null {
  const cleaned = spec.replace(/\\/g, '/');
  const base = norm(join(fromDir, cleaned).replace(/\\/g, '/'));
  // TypeScript ESM / NodeNext: `import './a.js'` resolves to `a.ts` on disk.
  const stem = base.replace(/\.(mjs|cjs|jsx?|tsx?)$/i, '');
  const candidates = [
    base,
    stem,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.js`,
    `${stem}.jsx`,
    `${stem}.mjs`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
    `${stem}/index.js`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.js`,
  ];
  for (const c of candidates) {
    const n = norm(c);
    if (pathIndex.has(n)) return n;
  }
  // Fuzzy: pathIndex may use forward slashes already
  for (const p of pathIndex) {
    if (
      p === base ||
      p === stem ||
      p === `${stem}.ts` ||
      p === `${stem}.tsx` ||
      p === `${stem}.js` ||
      p === `${base}.ts` ||
      p === `${base}.js` ||
      (p.startsWith(`${stem}/`) && /\/index\.(t|j)sx?$/.test(p))
    ) {
      return p;
    }
  }
  return null;
}

function kindFromExportMatch(raw: string): CodeSymbolNode['kind'] {
  if (/\bclass\b/.test(raw)) return 'class';
  if (/\bfunction\b/.test(raw)) return 'function';
  if (/\binterface\b/.test(raw)) return 'interface';
  if (/\btype\b/.test(raw)) return 'type';
  if (/\bconst\b|\blet\b/.test(raw)) return 'const';
  return 'unknown';
}

function inferRole(path: string): string | undefined {
  const p = path.toLowerCase();
  if (/\.(test|spec)\./.test(p) || /(^|\/)tests?\//.test(p)) return 'test';
  if (/routes?\./.test(p) || /\/routes\//.test(p)) return 'route';
  if (/middleware/.test(p)) return 'middleware';
  if (/service/.test(p)) return 'service';
  if (/repository|repos?\//.test(p)) return 'repository';
  if (/\/db\/|schema|migration/.test(p)) return 'database';
  if (/worker|job/.test(p)) return 'worker';
  if (/client|stripe|adapter/.test(p)) return 'adapter';
  return undefined;
}

function summarizeFile(p: FileParse): string {
  const bits = [
    p.role ? `Role: ${p.role}` : undefined,
    p.exports.length ? `Exports: ${p.exports.slice(0, 6).join(', ')}` : undefined,
    p.imports.filter((i) => i.resolved).length
      ? `Imports ${p.imports.filter((i) => i.resolved).length} local module(s)`
      : undefined,
  ].filter(Boolean);
  return bits.join('. ') || `Source file ${p.path}`;
}

function conceptsFrom(...parts: string[]): string[] {
  const raw = parts.join(' ');
  const tokens = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-/./]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 3 && t.length <= 24);
  return [...new Set(tokens)].slice(0, 8);
}

function prioritizeSymbols(symbols: CodeSymbolNode[]): CodeSymbolNode[] {
  const weight = (s: CodeSymbolNode): number => {
    if (s.kind === 'route') return 0;
    if (s.kind === 'class') return 1;
    if (s.kind === 'function') return 2;
    if (s.kind === 'method') return 3;
    if (s.exported) return 4;
    return 5;
  };
  return [...symbols].sort((a, b) => weight(a) - weight(b) || a.id.localeCompare(b.id));
}

function prioritizeEdges(edges: CodeEdge[]): CodeEdge[] {
  const conf = { high: 0, medium: 1, low: 2 };
  const typeW: Record<string, number> = {
    IMPORTS: 0,
    EXPORTS: 1,
    ROUTE_TO: 2,
    CALLS: 3,
    EXTENDS: 4,
    IMPLEMENTS: 5,
    DEFINED_IN: 6,
    BELONGS_TO: 7,
    REFERENCES: 8,
  };
  // Drop low-confidence CALLS entirely — trust over completeness.
  const filtered = edges.filter(
    (e) => !(e.type === 'CALLS' && e.confidence === 'low') && !(e.type === 'ROUTE_TO' && e.confidence === 'low'),
  );
  return [...filtered].sort(
    (a, b) =>
      conf[a.confidence] - conf[b.confidence] ||
      (typeW[a.type] ?? 9) - (typeW[b.type] ?? 9) ||
      a.from.localeCompare(b.from),
  );
}

function norm(p: string): string {
  return normalize(p).replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Merge incremental code intelligence into a prior snapshot. */
export function mergeCodeIntelligence(
  prior: CodeIntelligence | undefined,
  next: CodeIntelligence,
  options: { deletedPaths?: string[]; replacedPaths?: string[] } = {},
): CodeIntelligence {
  const deleted = new Set((options.deletedPaths ?? []).map(norm));
  const replaced = new Set((options.replacedPaths ?? []).map(norm));
  const pathGone = (path: string): boolean => {
    const p = norm(path);
    if (deleted.has(p) || replaced.has(p)) return true;
    for (const d of deleted) {
      const prefix = d.endsWith('/') ? d : `${d}/`;
      if (p === d || p.startsWith(prefix)) return true;
      if (p.endsWith('/') && d.startsWith(p)) return true;
    }
    return false;
  };

  const base = prior ?? emptyCodeIntelligence();
  const files = [
    ...base.files.filter((f) => !pathGone(f.path)),
    ...next.files,
  ];
  const fileMap = new Map<string, CodeFileNode>();
  for (const f of files) fileMap.set(f.path, f);

  const symbols = [
    ...base.symbols.filter((s) => !pathGone(s.path)),
    ...next.symbols,
  ];
  const symMap = new Map<string, CodeSymbolNode>();
  for (const s of symbols) symMap.set(s.id, s);

  const edges = [
    ...base.edges.filter((e) => !pathGone(e.from.split('#')[0]!) && !pathGone(e.to.split('#')[0]!)),
    ...next.edges,
  ];
  const edgeKey = (e: CodeEdge) => `${e.type}|${e.from}|${e.to}`;
  const edgeMap = new Map<string, CodeEdge>();
  for (const e of edges) edgeMap.set(edgeKey(e), e);

  return {
    version: 1,
    updatedAt: next.updatedAt,
    files: [...fileMap.values()].slice(0, MAX_FILES),
    symbols: prioritizeSymbols([...symMap.values()]).slice(0, MAX_SYMBOLS),
    edges: prioritizeEdges([...edgeMap.values()]).slice(0, MAX_EDGES),
  };
}
