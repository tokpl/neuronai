#!/usr/bin/env node
import { cac } from 'cac';

import { NotImplementedError } from '@neuronai/types';

import { runCursorDoctor } from './commands/cursor-doctor.js';
import { runCursorInit } from './commands/cursor-init.js';
import { runCursorSetup } from './commands/cursor-setup.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runReset } from './commands/reset.js';
import { runScan } from './commands/scan.js';
import { runSearch } from './commands/search.js';
import { runStatus } from './commands/status.js';
import { isNeuronCliError, printNeuronError } from './diagnostics/errors.js';
import { CLI_VERSION } from './services/neuron-fs.js';
import { ui } from './ui/output.js';

const COMMAND_GUIDE = `
NeuronAI - Neuron - AI Memory

Usage:
  neuron <command> [options]

Getting started:
  neuron init              Create .neuron/ + scan + wire Cursor MCP
  neuron status            Project + memory status
  neuron doctor            Diagnose local setup

Memory:
  neuron build             Rebuild / refresh project brain from code
  neuron scan              Same as build (fast scan)
  neuron scan --deep       Deep scan (relations)
  neuron scan --update     Incremental update from cache
  neuron search <query>    Search memories
  neuron reset --force     Wipe local .neuron/ memory

Cursor:
  neuron cursor setup      Write .cursor MCP / rules / skills
  neuron cursor doctor     Diagnose Cursor integration
  neuron mcp               Start MCP server (stdio)

Also available as: neuronai (same CLI)
`.trim();

export function createCli() {
  const cli = cac('neuron');

  cli.version(CLI_VERSION);
  cli.help();

  cli
    .command('init', 'Create .neuron/, scan the project, and wire Cursor MCP')
    .option('--force', 'Overwrite existing Neuron config')
    .option('--skip-analyze', 'Skip first project scan')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runInit(process.cwd(), options);
    });

  cli
    .command('init cursor', 'Bootstrap Neuron + Cursor (rules, skills, MCP)')
    .option('--force', 'Reinitialize and overwrite Cursor templates')
    .option('--skip-analyze', 'Skip first project scan')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runCursorInit(process.cwd(), options);
    });

  cli.command('status', 'Show project and memory status').action(async () => {
    await runStatus(process.cwd());
  });

  cli
    .command('build', 'Rebuild project brain from the codebase (scan + seed)')
    .option('--deep', 'Deep scan including code relationships')
    .option('--update', 'Incremental update using scan cache')
    .option('--architecture', 'Architecture-focused scan')
    .action(async (options: { deep?: boolean; update?: boolean; architecture?: boolean }) => {
      ui.title('Neuron build');
      ui.info('Refreshing local project brain under .neuron/');
      await runScan(process.cwd(), {
        deep: options.deep ?? true,
        update: options.update,
        architecture: options.architecture,
      });
      await runStatus(process.cwd());
    });

  cli
    .command('scan', 'Bootstrap / refresh project brain from the codebase')
    .option('--deep', 'Deep scan including code relationships')
    .option('--update', 'Incremental update using scan cache')
    .option('--architecture', 'Architecture-focused scan')
    .action(async (options: { deep?: boolean; update?: boolean; architecture?: boolean }) => {
      await runScan(process.cwd(), options);
    });

  cli
    .command('reset', 'Reset local .neuron/ memory for this project (destructive)')
    .option('--force', 'Confirm destructive reset')
    .action(async (options: { force?: boolean }) => {
      await runReset(process.cwd(), options);
    });

  cli
    .command('search <query>', 'Search project memories')
    .action(async (query: string) => {
      await runSearch(query, process.cwd());
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
    .option('--skip-analyze', 'Skip first project scan')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean }) => {
      await runCursorInit(process.cwd(), options);
    });

  cli.command('cursor doctor', 'Diagnose Cursor MCP, rules, skills, and project brain').action(async () => {
    await runCursorDoctor(process.cwd());
  });

  cli
    .command('mcp', 'Start the Neuron MCP server over stdio (for Cursor)')
    .action(async () => {
      const { startMcpServer } = await import('@neuronai/mcp-server');
      await startMcpServer(process.env['NEURON_CWD'] ?? process.cwd());
    });

  return cli;
}

function printGuide(): void {
  console.log(COMMAND_GUIDE);
  console.log('');
  ui.suggest('neuron init');
  ui.suggest('neuron status');
  ui.suggest('neuron build');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printGuide();
    return;
  }

  const isHelp = argv.includes('-h') || argv.includes('--help') || argv[0] === 'help';
  const isVersion = argv.includes('-v') || argv.includes('--version');
  const subcommand = argv.find((a) => !a.startsWith('-'));

  const cli = createCli();
  cli.parse(process.argv, { run: false });

  if (isHelp) {
    // cac already printed command-specific help when a subcommand was present
    if (!subcommand || subcommand === 'help') printGuide();
    return;
  }

  if (isVersion) {
    return;
  }

  if (!cli.matchedCommand) {
    ui.error(`Unknown command: ${subcommand ?? argv[0]}`);
    ui.blank();
    printGuide();
    process.exitCode = 1;
    return;
  }

  try {
    await cli.runMatchedCommand();
  } catch (error) {
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
          'MCP config missing - expected .cursor/mcp.json with server "neuron"',
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
