import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { defaultNeuronConfig } from '@neuron-ai-memory/config';
import { createProjectResolver } from '@neuron-ai-memory/project-analyzer';

import type { NeuronLocalConfig } from '../config/local-config.js';
import { DEFAULT_IGNORE } from '../config/local-config.js';
import { createConfigValidator } from '../config/config-validator.js';
import { NeuronCliError } from '../diagnostics/errors.js';
import { ProgressUI } from '../progress/progress-ui.js';
import {
  FIRST_RUN_WELCOME,
  PRIVACY_BANNER,
  formatNeuronReport,
  type NeuronInitReport,
} from '../templates/first-run.js';
import { CLI_VERSION, pathExists } from '../services/neuron-fs.js';
import { setupCursorIntegration, syncProjectBrainFiles } from '../services/cursor-setup.js';
import {
  ensureIntegrationStubs,
  isNeuronInitialized,
  neuronPaths,
  saveLocalConfig,
  saveMetadata,
} from '../services/neuron-fs.js';
import { analyzeAndSeedMemories, openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

function pickFramework(stack: string[], frameworks: string[]): string {
  const fromFw = frameworks[0];
  if (fromFw) return fromFw;
  const hit = stack.find((s) =>
    /next|react|vue|nuxt|svelte|angular|express|nestjs|fastapi|django|rails/i.test(s),
  );
  return hit ?? 'unknown';
}

function pickDatabase(stack: string[]): string {
  const hit = stack.find((s) =>
    /postgres|mysql|sqlite|mongo|redis|prisma|drizzle|supabase/i.test(s),
  );
  if (!hit) return 'none detected';
  return hit.replace(/^db:/, '');
}

function architectureConfidence(input: {
  modules: number;
  files: number;
  memories: number;
  hasFramework: boolean;
}): number {
  let score = 55;
  if (input.hasFramework) score += 15;
  if (input.modules > 0) score += 10;
  if (input.files > 50) score += 8;
  if (input.files > 500) score += 5;
  if (input.memories > 10) score += 7;
  return Math.min(98, score);
}

export async function runInit(
  cwd = process.cwd(),
  options: { force?: boolean; skipAnalyze?: boolean } = {},
): Promise<void> {
  const paths = neuronPaths(cwd);

  if ((await isNeuronInitialized(cwd)) && !options.force) {
    ui.warn(`Neuron already initialized at ${paths.neuronDir}`);
    ui.suggest('Use --force to reinitialize, or run: neuron analyze');
    ui.suggest('For Cursor wiring only: neuron cursor setup');
    return;
  }

  ui.blank();
  for (const line of FIRST_RUN_WELCOME) {
    if (line === '') ui.blank();
    else if (line.startsWith('Welcome')) ui.title(line);
    else ui.info(line);
  }
  ui.blank();
  for (const line of PRIVACY_BANNER) {
    ui.success(line);
  }
  ui.blank();

  const progress = new ProgressUI(7);
  const report: NeuronInitReport = {
    projectName: 'unknown',
    framework: 'unknown',
    database: 'none detected',
    modules: 0,
    filesAnalyzed: 0,
    memoriesCreated: 0,
    architectureConfidence: 0,
    cursorRules: false,
    mcpConfigured: false,
  };

  // 1. Environment check
  progress.start('Environment check…');
  const nodeMajor = Number(/^v(\d+)/.exec(process.version)?.[1] ?? 0);
  if (nodeMajor < 22) {
    throw new NeuronCliError({
      title: 'Neuron cannot initialize this project because:',
      reason: `Node.js ${process.version} is below the required major version 22.`,
      solution: 'Install Node.js 22 or newer, then re-run neuron init.',
      commands: ['node --version'],
    });
  }
  progress.ok(`Node ${process.version}`);

  // 2. Project detection
  progress.start('Project detection…');
  const project = await createProjectResolver().resolve(cwd);
  const hasManifest = project.manifests.length > 0;
  if (!hasManifest) {
    progress.warn('No package manifests found — using folder name');
  } else {
    progress.ok(`Detected project: ${project.name}`);
  }
  report.projectName = project.name;

  // 3. Technology detection
  progress.start('Technology detection…');
  const framework = pickFramework(project.stack, project.frameworks);
  const database = pickDatabase(project.stack);
  report.framework = framework;
  report.database = database;
  progress.ok(`Detected ${framework}`);
  if (database !== 'none detected') {
    progress.ok(`Found database layer (${database})`);
  }

  const localConfig: NeuronLocalConfig = {
    schemaVersion: 1,
    project: {
      id: project.projectId,
      name: project.name,
      slug: project.slug,
      stack: project.stack,
    },
    memory: {
      autoSave: false,
      threshold: 0.45,
    },
    privacy: {
      mode: 'suggest',
      localOnly: true,
      telemetry: false,
    },
    scan: {
      depth: 'fast',
      ignore: [...DEFAULT_IGNORE],
    },
    providers: {
      local: { enabled: true },
    },
    integrations: {
      cursor: true,
      claudeCode: false,
      vscode: false,
    },
    server: {
      mode: 'local',
    },
  };

  const validation = createConfigValidator().validate(localConfig, cwd);
  if (!validation.ok) {
    throw new NeuronCliError({
      title: 'Neuron cannot write configuration because:',
      reason: validation.issues.map((i) => `${i.path}: ${i.message}`).join('; '),
      solution: 'Fix invalid settings and re-run neuron init.',
    });
  }

  await saveLocalConfig(localConfig, cwd);
  await saveMetadata(
    {
      initializedAt: new Date().toISOString(),
      lastSyncAt: null,
      lastAnalyzeAt: null,
      memoryCount: 0,
      version: CLI_VERSION,
    },
    cwd,
  );

  const rootConfig = {
    ...defaultNeuronConfig,
    project: {
      name: project.name,
      type: 'application',
      stack: project.stack,
    },
    memory: {
      ...defaultNeuronConfig.memory,
      autoSave: localConfig.memory.autoSave,
      importanceThreshold: localConfig.memory.threshold,
    },
  };
  await writeFile(
    join(paths.root, 'neuron.config.json'),
    `${JSON.stringify(rootConfig, null, 2)}\n`,
    'utf8',
  );
  await ensureIntegrationStubs(cwd);

  // 4. Initial scan
  progress.start('Initial scan…');
  let stored = 0;
  let candidates = 0;
  let skipped = 0;
  let scanModules = 0;
  let scanFiles = 0;
  let scanMemories = 0;

  const session = await openProjectSession(cwd);
  await session.persist();

  if (!options.skipAnalyze) {
    const result = await analyzeAndSeedMemories(session, {
      threshold: localConfig.memory.threshold,
    });
    stored = result.stored;
    candidates = result.candidates;
    skipped = result.skipped;

    try {
      const { createProjectBrainBootstrap } = await import('@neuron-ai-memory/project-scanner');
      const scanReport = await createProjectBrainBootstrap().scan({
        root: cwd,
        mode: 'fast',
        projectName: localConfig.project.name,
      });
      scanModules = scanReport.modules;
      scanFiles = scanReport.filesScanned;
      scanMemories = scanReport.memoriesCreated;
      progress.ok(`Created architecture graph (${scanReport.relationships} relations)`);
      progress.ok(
        `Generated initial memories (${stored + scanMemories} total · ${candidates} candidates)`,
      );
    } catch (err) {
      progress.warn(`Scan partial: ${err instanceof Error ? err.message : 'unknown error'}`);
      progress.ok(`Generated initial memories (${stored})`);
    }
  } else {
    progress.warn('Initial scan skipped (--skip-analyze)');
  }

  report.modules = scanModules;
  report.filesAnalyzed = scanFiles;
  report.memoriesCreated = stored + scanMemories;

  // 5. Brain creation
  progress.start('Brain creation…');
  await syncProjectBrainFiles(cwd);
  progress.ok('Project brain files written (.neuron/*.md)');

  // 6. Cursor integration
  progress.start('Cursor integration…');
  const cursorAlready = await pathExists(join(paths.root, '.cursor'));
  if (!cursorAlready) {
    progress.warn('Cursor folder not found yet — creating .cursor/ for MCP');
  }
  const cursor = await setupCursorIntegration(cwd, { force: options.force });
  report.mcpConfigured = cursor.mcpValid;
  report.cursorRules = cursor.mcpValid;
  if (cursor.mcpValid) {
    progress.ok('Created Cursor rules + MCP (.cursor/)');
  } else {
    throw new NeuronCliError({
      title: 'Neuron cannot finish Cursor setup because:',
      reason: cursor.mcpErrors.length
        ? cursor.mcpErrors.join('; ')
        : 'Invalid mcp.json after write',
      solution: 'Re-run Cursor setup and verify MCP configuration.',
      commands: ['neuron cursor setup --force', 'neuron cursor doctor'],
    });
  }

  // 7. Ready
  progress.start('Ready');
  report.architectureConfidence = architectureConfidence({
    modules: report.modules,
    files: report.filesAnalyzed,
    memories: report.memoriesCreated,
    hasFramework: framework !== 'unknown',
  });
  progress.ok('Local AI brain is ready');
  progress.done();

  ui.blank();
  for (const line of formatNeuronReport(report)) {
    if (line === 'Neuron Report') ui.title(line);
    else if (line === '') ui.blank();
    else if (line.endsWith(':') && !line.startsWith(' ')) console.log(line);
    else ui.info(line);
  }

  ui.blank();
  ui.welcome([
    'AI just learned your project.',
    `Stack: ${framework}${database !== 'none detected' ? ` · ${database}` : ''}`,
    `Memories seeded: ${report.memoriesCreated}` +
      (candidates ? ` (${candidates} candidates, ${skipped} skipped)` : ''),
    `Privacy: local-only · telemetry OFF`,
    `Cursor MCP: ${cursor.mcpPath}`,
  ]);
  ui.blank();
  ui.suggest('Open this folder in Cursor and enable MCP server "neuron"');
  ui.suggest('Verify: neuron doctor');
  ui.suggest('Explain: neuron explain');
  ui.suggest('First chat: Prepare adding a feature using Neuron');
}
