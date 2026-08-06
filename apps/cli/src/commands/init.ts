import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { openProjectBrain } from '@neuronai/brain';
import { defaultNeuronConfig } from '@neuronai/config';
import { createProjectResolver } from '@neuronai/project-analyzer';

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
import { applyNeuronGitignore } from '../services/gitignore.js';
import {
  isNeuronInitialized,
  loadMetadata,
  neuronPaths,
  saveLocalConfig,
  saveMetadata,
} from '../services/neuron-fs.js';
import { analyzeAndSeedMemories, openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

import { askInitPreferences } from './init-preferences.js';

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

function pickTag(stack: string[], pattern: RegExp): string {
  return stack.find((s) => pattern.test(s)) ?? 'unknown';
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
  options: { force?: boolean; skipAnalyze?: boolean; yes?: boolean } = {},
): Promise<void> {
  const paths = neuronPaths(cwd);

  if ((await isNeuronInitialized(cwd)) && !options.force) {
    ui.warn(`Neuron already initialized at ${paths.neuronDir}`);
    ui.suggest('Use --force to reinitialize, or run: neuron scan');
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

  const progress = new ProgressUI(8);
  const report: NeuronInitReport = {
    projectName: 'unknown',
    language: 'unknown',
    framework: 'unknown',
    database: 'none detected',
    packageManager: 'unknown',
    git: false,
    modules: 0,
    moduleNames: [],
    filesAnalyzed: 0,
    memoriesCreated: 0,
    decisions: 0,
    conventions: 0,
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
    progress.warn('No package manifests found - using folder name');
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
  report.language = pickTag(
    project.stack,
    /^(typescript|javascript|python|go|rust|java|php|ruby)$/i,
  );
  report.packageManager = pickTag(project.stack, /^pm:/i).replace(/^pm:/, '');
  report.git = await pathExists(join(cwd, '.git'));
  if (framework !== 'unknown') progress.ok(`Detected ${framework}`);
  else progress.warn('No framework signature found - continuing');
  if (database !== 'none detected') {
    progress.ok(`Found database layer (${database})`);
  }

  // 4. Preferences (interactive unless --yes / non-TTY / CI)
  progress.start('Preferences…');
  const prefs = await askInitPreferences({ useDefaults: options.yes === true });
  const localConfig: NeuronLocalConfig = {
    schemaVersion: 1,
    project: {
      id: project.projectId,
      name: project.name,
      slug: project.slug,
      stack: project.stack,
    },
    memory: {
      autoSave: prefs.memory.autoSave,
      threshold: 0.45,
    },
    privacy: {
      mode: prefs.memory.privacyMode,
      localOnly: true,
      telemetry: false,
    },
    scan: {
      depth: 'fast',
      ignore: [...DEFAULT_IGNORE],
    },
    integrations: {
      cursor: true,
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
  const brain = await openProjectBrain(cwd, {
    seed: {
      projectId: project.projectId,
      name: project.name,
      stack: project.stack,
      summary: `${framework} project initialized with Neuron local memory`,
    },
  });
  brain.seedIdentity({
    projectId: project.projectId,
    name: project.name,
    stack: project.stack,
    summary: `${framework} project initialized with Neuron local memory`,
  });
  await brain.save();
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
      autoSave: localConfig.memory.autoSave,
      importanceThreshold: localConfig.memory.threshold,
      // contextMaxTokens uses schema default (how much memory is injected per agent turn)
    },
  };
  await writeFile(
    join(paths.root, 'neuron.config.json'),
    `${JSON.stringify(rootConfig, null, 2)}\n`,
    'utf8',
  );
  const gitignore = await applyNeuronGitignore(cwd, prefs.gitignore);
  const saveLabel =
    prefs.memory.privacyMode === 'automatic'
      ? 'Remember automatically (high-confidence knowledge is saved without asking)'
      : prefs.memory.privacyMode === 'manual'
        ? 'Only when you ask'
        : 'Ask before adding durable knowledge to the Project Brain (Yes / No / Edit)';
  progress.ok(`Save mode: ${saveLabel}`);
  if (gitignore.applied) {
    progress.ok(`.gitignore updated (${prefs.gitignore})`);
  } else if (prefs.gitignore === 'skip') {
    progress.warn('.gitignore left unchanged');
  } else {
    progress.ok('.gitignore already up to date');
  }

  // 5. Initial scan
  progress.start('Initial scan…');
  let stored = 0;
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

    try {
      const scan = await session.scan('fast');
      scanModules = scan.report.modules;
      scanFiles = scan.report.filesScanned;
      scanMemories = scan.memoriesStored;
      report.moduleNames = scan.report.architecture.modules;
      const meta = await loadMetadata(cwd);
      meta.lastAnalyzeAt = new Date().toISOString();
      meta.memoryCount = session.listMemories().length;
      const { readGitIdentity } = await import('../services/git-identity.js');
      const git = readGitIdentity(cwd);
      meta.lastScanGitHead = git.head;
      meta.lastScanGitBranch = git.branch;
      await saveMetadata(meta, cwd);
      progress.ok(
        scanModules > 0
          ? `Mapped ${scanModules} modules across ${scanFiles} files`
          : `Read ${scanFiles} files`,
      );
      progress.ok(`Learned ${stored + scanMemories} things about this project`);
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
  report.decisions = session.brain.knowledge.decisions.length;
  report.conventions = session.brain.knowledge.rules.length;

  // 6. Brain creation
  progress.start('Brain creation…');
  await syncProjectBrainFiles(cwd);
  progress.ok('Project Brain written (.neuron/brain/ + prefs.json)');

  // 7. Cursor integration
  progress.start('Cursor integration…');
  const cursorAlready = await pathExists(join(paths.root, '.cursor'));
  if (!cursorAlready) {
    progress.warn('Cursor folder not found yet - creating .cursor/ for MCP');
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

  // 8. Ready
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
    if (line === 'What Neuron learned') ui.title(line);
    else if (line === '') ui.blank();
    else if (!line.startsWith(' ')) console.log(line);
    else ui.info(line);
  }

  ui.blank();
  ui.welcome([
    `The brain lives in ${paths.neuronDir.replace(paths.root, '.')}`,
    'Commit .neuron/brain/ to share it with your team.',
    `New knowledge: ${
      prefs.memory.privacyMode === 'automatic'
        ? 'saved automatically'
        : prefs.memory.privacyMode === 'manual'
          ? 'only when you ask'
          : 'Neuron asks before saving anything'
    }`,
    'Nothing leaves this machine. No cloud, no API key, no telemetry.',
  ]);
  ui.blank();
  console.log('Next:');
  ui.blank();
  ui.info('  1. Enable MCP in Cursor — Settings → Tools & MCP → turn on "neuron"');
  ui.info('     If you upgraded NeuronAI, toggle it off/on (or restart Cursor) so the tool list refreshes.');
  ui.info('  2. Ask your coding agent to change something — it should call neuron_context first');
  ui.info('  3. Or inspect locally — neuron context "where should I add …?"');
  ui.info('  4. Check health — neuron doctor');
  ui.blank();
  ui.info('  neuron cursor    shows the Cursor connection status any time');
}
