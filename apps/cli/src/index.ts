#!/usr/bin/env node
import { cac } from 'cac';

import { NotImplementedError } from '@neuronai/types';

import { NEURON_BRAIN_FINGERPRINT } from './brain-fingerprint.generated.js';
import { runBrain } from './commands/brain.js';
import { runContext } from './commands/context.js';
import { runCursor } from './commands/cursor.js';
import { runCursorDoctor } from './commands/cursor-doctor.js';
import { runCursorInit } from './commands/cursor-init.js';
import { runCursorSetup } from './commands/cursor-setup.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runRemember } from './commands/remember.js';
import { runReset } from './commands/reset.js';
import { runScan } from './commands/scan.js';
import { runSearch } from './commands/search.js';
import { runStatus } from './commands/status.js';
import { isNeuronCliError, printNeuronError } from './diagnostics/errors.js';
import { CLI_VERSION } from './services/neuron-fs.js';
import { ui } from './ui/output.js';

const CLI_VERSION_LABEL = `${CLI_VERSION} (brain ${NEURON_BRAIN_FINGERPRINT.brainVersion}@${NEURON_BRAIN_FINGERPRINT.rankSha})`;
const COMMAND_GUIDE = `
NeuronAI — a local-first Project Brain for AI coding assistants

Usage:
  neuron <command> [options]

Start here:
  neuron init              Detect the project, build the brain, wire Cursor
  neuron cursor            Check the Cursor connection and what to do next

The brain:
  neuron scan              Re-learn from the codebase (--deep, --update)
  neuron context <question> What Neuron would tell an AI about this task
  neuron search <query>    Search what the project knows
  neuron remember <text>   Add something yourself
  neuron brain             Metrics: measured, derived, estimated
  neuron status            Project and memory overview

Maintenance:
  neuron doctor            Diagnose the brain, storage and Cursor setup
  neuron reset --force     Delete the local brain
  neuron mcp               Run the MCP server (Cursor calls this for you)

Everything stays in .neuron/ in this project. No cloud, no API key, no telemetry.
Also available as: neuronai
`.trim();

export function createCli() {
  const cli = cac('neuron');

  cli.version(CLI_VERSION_LABEL);
  cli.help();

  cli
    .command('init', 'Create .neuron/, scan the project, and wire Cursor MCP')
    .option('--force', 'Overwrite existing Neuron config')
    .option('--skip-analyze', 'Skip first project scan')
    .option('--yes, -y', 'Accept recommended defaults (non-interactive)')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean; yes?: boolean }) => {
      await runInit(process.cwd(), options);
    });

  cli
    .command('init cursor', 'Bootstrap Neuron + Cursor (rules, skills, MCP)')
    .option('--force', 'Reinitialize and overwrite Cursor templates')
    .option('--skip-analyze', 'Skip first project scan')
    .option('--yes, -y', 'Accept recommended defaults (non-interactive)')
    .action(async (options: { force?: boolean; skipAnalyze?: boolean; yes?: boolean }) => {
      await runCursorInit(process.cwd(), options);
    });

  cli.command('status', 'Show project and memory status').action(async () => {
    await runStatus(process.cwd());
  });

  cli
    .command('brain', 'Show Project Brain metrics (measured · derived · estimated)')
    .option('--explain <metric>', 'Explain one metric (e.g. health, architecture_confidence)')
    .action(async (options: { explain?: string }) => {
      await runBrain(process.cwd(), { explain: options.explain });
    });

  cli
    .command('scan', 'Re-learn the project brain from the codebase')
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

  cli.command('search <query>', 'Search the project brain').action(async (query: string) => {
    await runSearch(query, process.cwd());
  });

  cli
    .command('context <query>', 'Show the project context Neuron would give an AI')
    .action(async (query: string) => {
      await runContext(query, process.cwd());
    });

  cli
    .command('remember <text>', 'Add something to the project brain')
    .option('--type <type>', 'decision | pattern | mistake | business_rule | knowledge')
    .option('--title <title>', 'Short title (derived from the text otherwise)')
    .option('--yes, -y', 'Skip the confirmation prompt')
    .action(async (text: string, options: { type?: string; title?: string; yes?: boolean }) => {
      await runRemember(text, process.cwd(), options);
    });

  cli.command('doctor', 'Diagnose the brain, storage and Cursor setup').action(async () => {
    await runDoctor(process.cwd());
  });

  // One command with an optional action. Registering `cursor` alongside
  // `cursor setup` made cac match the bare form and silently ignore the
  // subcommand, so `cursor setup` reported success without writing anything.
  cli
    .command('cursor [action]', 'Cursor status; actions: setup, doctor')
    .option('--force', 'With setup: overwrite rules, skills and commands')
    .action(async (action: string | undefined, options: { force?: boolean }) => {
      if (action === 'setup') {
        await runCursorSetup(process.cwd(), options);
        return;
      }
      if (action === 'doctor') {
        await runCursorDoctor(process.cwd());
        return;
      }
      if (action) {
        ui.error(`Unknown action: neuron cursor ${action}`);
        ui.blank();
        ui.suggest('neuron cursor          connection status and next steps');
        ui.suggest('neuron cursor setup    write .cursor/ config, rules and skills');
        ui.suggest('neuron cursor doctor   diagnose the Cursor integration');
        process.exitCode = 1;
        return;
      }
      await runCursor(process.cwd());
    });

  cli.command('mcp', 'Start the Neuron MCP server over stdio (for Cursor)').action(async () => {
    const { startMcpServer } = await import('@neuronai/mcp-server');
    try {
      await startMcpServer(process.env['NEURON_CWD'] ?? process.cwd());
    } catch (error) {
      // The host closing the pipe is a normal shutdown, not a failure.
      if (isStreamClosed(error)) return;
      throw error;
    }
  });

  return cli;
}

function printGuide(): void {
  console.log(COMMAND_GUIDE);
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

  // Handle top-level help before cac parses, otherwise both its generated help
  // and our guide are printed one after the other.
  if (isHelp && (!subcommand || subcommand === 'help')) {
    printGuide();
    return;
  }

  const cli = createCli();
  cli.parse(process.argv, { run: false });

  if (isHelp) {
    // cac printed command-specific help during parse
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
    if (isStreamClosed(error)) return;

    const message = error instanceof Error ? error.message : String(error);
    // Only a genuine transport failure earns the MCP wiring help. Matching the
    // word "MCP" anywhere in a message produced misleading advice for unrelated errors.
    if (errorCode(error) === 'ECONNREFUSED') {
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

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

function isStreamClosed(error: unknown): boolean {
  const code = errorCode(error);
  if (code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED') return true;
  const message = error instanceof Error ? error.message : '';
  return /closed stream|premature close|write after end/i.test(message);
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  void main();
}
