#!/usr/bin/env node
import { cac } from 'cac';

import { createLogger } from '@neuron-ai-memory/observability';
import { NotImplementedError } from '@neuron-ai-memory/types';

import { runAnalyze } from './commands/analyze.js';
import { runScan, runProjectReport } from './commands/scan.js';
import { runWatch } from './commands/watch.js';
import { runBackup, runMaintain, runPurge, runRestore } from './commands/backup.js';
import {
  runConstitutionAccept,
  runConstitutionCursorRules,
  runConstitutionEvolution,
  runConstitutionHealth,
  runConstitutionSuggest,
} from './commands/constitution.js';
import { runOptimizeContext } from './commands/optimize-context.js';
import {
  runBenchmark,
  runBenchmarkReport,
  runBenchmarkRetrieval,
} from './commands/benchmark.js';
import { runCursorDoctor } from './commands/cursor-doctor.js';
import { runCursorInit } from './commands/cursor-init.js';
import { runCursorSetup } from './commands/cursor-setup.js';
import { runDoctor } from './commands/doctor.js';
import { runDebug, runExplainLast } from './commands/debug.js';
import { runExplain } from './commands/explain.js';
import { runExport } from './commands/export.js';
import { runInit } from './commands/init.js';
import { runReset } from './commands/reset.js';
import { runSearch } from './commands/search.js';
import { runStatus } from './commands/status.js';
import { runSuggest } from './commands/suggest.js';
import { runUpdate } from './commands/update.js';
import { isNeuronCliError, printNeuronError } from './diagnostics/errors.js';
import { CLI_VERSION } from './services/neuron-fs.js';
import { ui } from './ui/output.js';

const logger = createLogger({ name: 'cli', level: 'info' });

export function createCli() {
  const cli = cac('neuron');

  cli.version(CLI_VERSION);
  cli.help();

  cli
    .command('init', 'Detect project, create .neuron/, wire MCP, seed first memories')
    .option('--force', 'Overwrite existing Neuron config')
    .option('--skip-analyze', 'Skip first project analysis')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runInit(process.cwd(), options);
    });

  cli
    .command('init cursor', 'Bootstrap Neuron + Cursor (rules, skills, MCP, project brain)')
    .option('--force', 'Reinitialize Neuron config and overwrite Cursor templates')
    .option('--skip-analyze', 'Skip first project analysis')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runCursorInit(process.cwd(), options);
    });

  cli.command('status', 'Show project, database, MCP, and memory status').action(async () => {
    await runStatus(process.cwd());
  });

  cli.command('explain', 'Explain the project brain in plain language').action(async () => {
    await runExplain(process.cwd());
  });

  cli
    .command('explain-last', 'Show the last Neuron operation trace (why it suggested this)')
    .action(async () => {
      await runExplainLast(process.cwd());
    });

  cli
    .command('debug', 'Toggle observability debug mode (verbose reasoning; default OFF)')
    .option('--on', 'Enable debug mode')
    .option('--off', 'Disable debug mode')
    .option('--retention <mode>', 'disable | temporary | persistent')
    .option('--demo', 'Record a sample trace for explain-last')
    .action(
      async (options: {
        on?: boolean;
        off?: boolean;
        retention?: string;
        demo?: boolean;
      }) => {
        await runDebug(process.cwd(), options);
      },
    );

  cli.command('analyze', 'Analyze project structure and create knowledge memories').action(async () => {
    await runAnalyze(process.cwd());
  });

  cli
    .command('scan', 'Bootstrap / refresh Project Brain from full codebase scan')
    .option('--deep', 'Deep scan including code relationships')
    .option('--update', 'Incremental update using scan cache')
    .option('--architecture', 'Architecture-focused scan')
    .action(async (options: { deep?: boolean; update?: boolean; architecture?: boolean }) => {
      await runScan(process.cwd(), options);
    });

  cli
    .command('update', 'Migrate schema/brain metadata and refresh project knowledge')
    .option('--schema-only', 'Skip knowledge scan; only migrate config/metadata')
    .action(async (options: { schemaOnly?: boolean }) => {
      await runUpdate(process.cwd(), { knowledge: !options.schemaOnly });
    });

  cli
    .command('reset', 'Reset local .neuron/ memory for this project (destructive)')
    .option('--force', 'Confirm destructive reset')
    .action(async (options: { force?: boolean }) => {
      await runReset(process.cwd(), options);
    });

  cli.command('project-report', 'Show latest Neuron Project Report').action(async () => {
    await runProjectReport(process.cwd());
  });

  cli
    .command('watch', 'Local continuous intelligence (filesystem + git). No uploads.')
    .action(async () => {
      await runWatch(process.cwd());
    });

  cli
    .command('optimize-context <task>', 'Preview optimized retrieval context for a task')
    .option('--explain', 'Show why items were selected')
    .option('--architecture', 'Use architecture budget / mode')
    .action(async (task: string, options: { explain?: boolean; architecture?: boolean }) => {
      await runOptimizeContext(task, process.cwd(), options);
    });

  cli
    .command('benchmark', 'Run Neuron memory-layer evaluation suite')
    .option('--fast', 'Skip 100k retrieval probe (CI-friendly)')
    .option('--out <file>', 'Report filename relative to cwd', { default: 'benchmark-report.md' })
    .action(async (options: { fast?: boolean; out?: string }) => {
      await runBenchmark(process.cwd(), options);
    });

  cli.command('benchmark report', 'Generate / print benchmark-report.md').action(async () => {
    await runBenchmarkReport(process.cwd());
  });

  cli
    .command('benchmark retrieval', 'Retrieval latency & token probes at scale')
    .option('--fast', 'Skip 100k probe')
    .action(async (options: { fast?: boolean }) => {
      await runBenchmarkRetrieval(process.cwd(), options);
    });

  cli.command('constitution suggest', 'Propose rules from memories and patterns').action(async () => {
    await runConstitutionSuggest(process.cwd());
  });

  cli
    .command('constitution accept <ruleId>', 'Approve + activate a suggested constitution rule')
    .option('--critical', 'Mark as CRITICAL (manual source — human confirmed)')
    .action(async (ruleId: string, options: { critical?: boolean }) => {
      await runConstitutionAccept(ruleId, process.cwd(), options);
    });

  cli.command('constitution health', 'Project health score').action(async () => {
    await runConstitutionHealth(process.cwd());
  });

  cli
    .command('constitution evolution', 'Periodic self-learning review')
    .option('--commits <n>', 'Commits since last review', { default: '50' })
    .action(async (options: { commits?: string }) => {
      await runConstitutionEvolution(process.cwd(), {
        commits: Number(options.commits ?? 50),
      });
    });

  cli
    .command('constitution cursor-rules', 'Generate .cursor/rules/project-architecture.mdc')
    .action(async () => {
      await runConstitutionCursorRules(process.cwd());
    });

  cli
    .command('search <query>', 'Search project memories')
    .action(async (query: string) => {
      await runSearch(query, process.cwd());
    });

  cli
    .command('suggest', 'Analyze git diff/commit and suggest a memory (agent workflow)')
    .option('--commit', 'Analyze latest commit instead of working tree')
    .option('--message <message>', 'Optional commit/task message override')
    .action(async (options: { commit?: boolean; message?: string }) => {
      await runSuggest(process.cwd(), options);
    });

  cli.command('export', 'Export memories to .neuron/export/*.md').action(async () => {
    await runExport(process.cwd());
  });

  cli
    .command('backup', 'Snapshot project brain (JSON + Markdown)')
    .option('--format <format>', 'json | markdown | both', { default: 'both' })
    .action(async (options: { format?: string }) => {
      const format = options.format as 'json' | 'markdown' | 'both' | undefined;
      await runBackup(process.cwd(), { format });
    });

  cli
    .command('restore <file>', 'Import memories from a brain.json snapshot')
    .action(async (file: string) => {
      await runRestore(file, process.cwd());
    });

  cli
    .command('purge', 'Delete local .neuron/ data for this project')
    .option('--force', 'Confirm destructive purge')
    .action(async (options: { force?: boolean }) => {
      await runPurge(process.cwd(), options);
    });

  cli.command('maintain', 'Analyze duplicates / stale memories (dry-run)').action(async () => {
    await runMaintain(process.cwd());
  });

  cli.command('doctor', 'Diagnose config, store, and MCP setup').action(async () => {
    await runDoctor(process.cwd());
  });

  cli
    .command('cursor setup', 'Write .cursor/mcp.json, rules, skills, and commands')
    .option('--force', 'Overwrite rules/skills/commands')
    .action(async (options: { force?: boolean }) => {
      await runCursorSetup(process.cwd(), options);
    });

  cli
    .command('cursor init', 'Alias for: neuron init cursor')
    .option('--force', 'Reinitialize and overwrite Cursor templates')
    .option('--skip-analyze', 'Skip first project analysis')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runCursorInit(process.cwd(), options);
    });

  cli.command('cursor doctor', 'Diagnose Cursor MCP, rules, skills, and project brain').action(async () => {
    await runCursorDoctor(process.cwd());
  });

  // Back-compat alias
  cli
    .command('connect cursor', 'Alias for: neuron cursor setup')
    .action(async () => {
      await runCursorSetup(process.cwd());
    });

  cli
    .command('mcp', 'Start the Neuron MCP server over stdio (for Cursor / Claude Code)')
    .action(async () => {
      const { startMcpServer } = await import('@neuron-ai-memory/mcp-server');
      await startMcpServer(process.env['NEURON_CWD'] ?? process.cwd());
    });

  return cli;
}

async function main(): Promise<void> {
  const cli = createCli();
  cli.parse(process.argv, { run: false });
  try {
    await cli.runMatchedCommand();
  } catch (error) {
    logger.error({ err: error }, 'CLI command failed');
    if (error instanceof NotImplementedError) {
      ui.error(error.message);
      process.exitCode = 2;
      return;
    }
    if (isNeuronCliError(error)) {
      printNeuronError(error);
      process.exitCode = 1;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|ENOENT|MCP|connect/i.test(message)) {
      ui.failHelp(
        'Neuron MCP cannot connect.',
        [
          'Cursor is closed or MCP was not reloaded',
          'MCP config missing — expected .cursor/mcp.json with server "neuron"',
          '`neuron` not on PATH for the Cursor process',
        ],
        ['neuron cursor doctor', 'neuron cursor setup --force'],
      );
    } else {
      ui.error(message);
    }
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  void main();
}
