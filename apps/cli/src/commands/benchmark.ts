import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createBenchmarkPlatform } from '@neuron-ai-memory/benchmark';

import { ui } from '../ui/output.js';

const platform = createBenchmarkPlatform();

export async function runBenchmark(
  cwd: string,
  options: { fast?: boolean; out?: string } = {},
): Promise<void> {
  ui.title('Neuron benchmark');
  ui.info(options.fast ? 'Mode: fast (skip 100k retrieval)' : 'Mode: full suite');
  const result = await platform.run({ fast: Boolean(options.fast) });
  const out = options.out ? join(cwd, options.out) : join(cwd, 'benchmark-report.md');
  await writeFile(out, result.markdown, 'utf8');
  ui.success(`Report written: ${out}`);
  ui.info(
    `Token reduction ${result.comparison.tokenReductionPct}% · precision ${(result.metrics.contextPrecision * 100).toFixed(0)}%`,
  );
}

export async function runBenchmarkReport(cwd: string): Promise<void> {
  ui.title('Neuron benchmark report');
  // Re-run fast suite to guarantee a fresh report artifact
  const result = await platform.run({ fast: true });
  const path = await platform.writeReport(cwd, result);
  ui.success(`Report: ${path}`);
  console.log(result.markdown);
}

export async function runBenchmarkRetrieval(
  cwd: string,
  options: { fast?: boolean } = {},
): Promise<void> {
  ui.title('Neuron retrieval benchmark');
  const rows = await platform.runRetrieval({ fast: Boolean(options.fast) });
  for (const r of rows) {
    ui.info(
      `${r.memoryCount} memories → ${r.latencyMs}ms · tokens ${r.tokenEstimate}/${r.budget} · rank ${(r.rankingQuality * 100).toFixed(0)}%`,
    );
  }
  const md = [
    '# Retrieval benchmark',
    '',
    '| Memories | Latency (ms) | Tokens | Ranking | Budget |',
    '|----------|-------------:|-------:|--------:|-------:|',
    ...rows.map(
      (r) =>
        `| ${r.memoryCount} | ${r.latencyMs} | ${r.tokenEstimate} | ${(r.rankingQuality * 100).toFixed(0)}% | ${r.budget} |`,
    ),
  ].join('\n');
  const path = join(cwd, 'benchmark-retrieval.md');
  await writeFile(path, md, 'utf8');
  ui.success(`Wrote ${path}`);
}
