import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  BenchmarkCategory,
  BenchmarkRunResult,
} from '../types.js';
import { newId, nowIso, round2 } from '../types.js';
import { createAnswerScorer } from '../scoring/answer-scorer.js';

/** Built-in Neuron Benchmark Suite categories. */
export const BUILTIN_BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'arch-auth',
    category: 'architecture',
    question: 'How does authentication work in this project?',
    expectedKeywords: ['auth', 'session', 'token', 'permission'],
    unexpectedKeywords: ['css', 'button style'],
    goldMemoryTitles: ['Authentication', 'Auth'],
  },
  {
    id: 'debug-null',
    category: 'debug',
    question: 'Why might null pointer errors appear after a refactor?',
    expectedKeywords: ['null', 'optional', 'guard', 'refactor'],
  },
  {
    id: 'sec-secrets',
    category: 'security',
    question: 'How should secrets be handled?',
    expectedKeywords: ['secret', 'env', 'never commit', 'redact'],
    unexpectedKeywords: ['hardcode api key'],
  },
  {
    id: 'perf-db',
    category: 'performance',
    question: 'What are common database performance risks?',
    expectedKeywords: ['index', 'n+1', 'query', 'connection'],
  },
  {
    id: 'docs-adr',
    category: 'documentation',
    question: 'How should architecture decisions be documented?',
    expectedKeywords: ['decision', 'adr', 'rationale', 'context'],
  },
];

/**
 * Loads project-specific cases from `.neuron/benchmarks/*.json`.
 */
export class ProjectBenchmarkLoader {
  async load(neuronDir: string): Promise<BenchmarkCase[]> {
    const dir = join(neuronDir, 'benchmarks');
    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
      const cases: BenchmarkCase[] = [];
      for (const file of files) {
        const raw = JSON.parse(await readFile(join(dir, file), 'utf8')) as
          | BenchmarkCase
          | { cases?: BenchmarkCase[] };
        if (Array.isArray((raw as { cases?: BenchmarkCase[] }).cases)) {
          cases.push(...((raw as { cases: BenchmarkCase[] }).cases));
        } else if ((raw as BenchmarkCase).id && (raw as BenchmarkCase).question) {
          cases.push(raw as BenchmarkCase);
        }
      }
      return cases;
    } catch {
      return [];
    }
  }
}

export function createProjectBenchmarkLoader(): ProjectBenchmarkLoader {
  return new ProjectBenchmarkLoader();
}

/**
 * Neuron Benchmark Suite — architecture / debug / security / performance / docs.
 * Answers are stubbed heuristically for offline scoring (no LLM calls required).
 */
export class NeuronBenchmarkSuite {
  private readonly scorer = createAnswerScorer();
  private readonly loader = createProjectBenchmarkLoader();

  async run(input: {
    neuronDir?: string;
    /** Simulated or real answers keyed by case id */
    answers?: Record<string, string>;
    includeBuiltin?: boolean;
  }): Promise<BenchmarkRunResult> {
    const projectCases = input.neuronDir
      ? await this.loader.load(input.neuronDir)
      : [];
    const cases = [
      ...(input.includeBuiltin !== false ? BUILTIN_BENCHMARK_CASES : []),
      ...projectCases,
    ];

    const results: BenchmarkCaseResult[] = [];
    for (const c of cases) {
      const answer =
        input.answers?.[c.id] ??
        heuristicAnswer(c);
      const evalResult = this.scorer.evaluate({
        task: c.question,
        answer,
        expectedKeywords: c.expectedKeywords,
        unexpectedKeywords: c.unexpectedKeywords,
      });
      results.push({
        caseId: c.id,
        category: c.category,
        score: evalResult.score,
        passed: evalResult.score >= 0.55,
        details: evalResult.criteria.map((x) => `${x.name}=${x.score}`).join(', '),
      });
    }

    const overall = results.length
      ? round2(results.reduce((s, r) => s + r.score, 0) / results.length)
      : 0;

    return {
      id: newId('bench'),
      source: projectCases.length ? 'project' : 'builtin',
      cases: results,
      overall,
      at: nowIso(),
    };
  }
}

function heuristicAnswer(c: BenchmarkCase): string {
  return `Regarding ${c.category}: ${c.expectedKeywords.join(', ')}. ${c.question}`;
}

export function createNeuronBenchmarkSuite(): NeuronBenchmarkSuite {
  return new NeuronBenchmarkSuite();
}

export type { BenchmarkCategory };
