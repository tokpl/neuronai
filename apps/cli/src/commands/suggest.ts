import {
  createAgentWorkflow,
  createGitMemoryAnalyzer,
  parsePrivacyMode,
} from '@neuron-ai-memory/agent-workflow';

import {
  isNeuronInitialized,
  loadLocalConfig,
  neuronPaths,
} from '../services/neuron-fs.js';
import { openProjectSession } from '../services/project-session.js';
import { ui } from '../ui/output.js';

export async function runSuggest(
  cwd = process.cwd(),
  options: { commit?: boolean; message?: string } = {},
): Promise<void> {
  if (!(await isNeuronInitialized(cwd))) {
    ui.error('Neuron is not initialized.');
    ui.suggest('Run: neuron init');
    process.exitCode = 1;
    return;
  }

  const config = await loadLocalConfig(cwd);
  const privacy = parsePrivacyMode(
    (config as { privacy?: { mode?: string } }).privacy?.mode ?? 'suggest',
  );

  ui.title('Neuron suggest');
  ui.kv('Privacy', privacy);

  const git = createGitMemoryAnalyzer(cwd);
  let diff = '';
  let files: string[] = [];
  let commitMessage = options.message;

  if (options.commit) {
    const latest = await git.analyzeLatestCommit();
    if (!latest) {
      ui.warn('No git commit found.');
      return;
    }
    diff = latest.commit.diff;
    files = latest.commit.files;
    commitMessage = latest.commit.message;
    ui.info(`  Analyzing commit ${latest.commit.hash.slice(0, 7)}`);
  } else {
    diff = await git.workingTreeDiff();
    if (!diff && !options.message) {
      ui.warn('No working tree changes. Try: neuron suggest --commit');
      return;
    }
  }

  const session = await openProjectSession(cwd);
  const workflow = createAgentWorkflow({
    projectId: config.project.id,
    privacy,
    engine: session.engine,
    listExistingMemories: async () =>
      session.listMemories().filter((m) => m.status === 'active'),
  });

  const result = await workflow.afterCoding({
    task: 'cli suggest',
    diff,
    files,
    commitMessage,
    summary: commitMessage,
  });

  ui.blank();
  ui.kv('Files', String(result.analysis.filesChanged));
  ui.kv('Impact', result.analysis.impact);
  ui.kv('Summary', result.analysis.summary);

  if (!result.suggestion) {
    ui.warn('No memory suggestion (manual mode or low signal).');
    return;
  }

  ui.blank();
  console.log(result.promptText);
  ui.blank();
  ui.kv('Type', result.suggestion.type);
  ui.kv('Confidence', result.suggestion.confidence.toFixed(2));
  ui.suggest('Save with: neuron analyze is not enough — use MCP neuron_save_decision or Cursor');
  void neuronPaths;
}
