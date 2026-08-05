import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createChangeImportanceAnalyzer } from './importance.js';
import type { GitCommitInsight, ProjectEvent } from '../types.js';
import { createProjectEventBus, type ProjectEventBus } from '../events/bus.js';

const execFileAsync = promisify(execFile);

/**
 * Local git intelligence — commit / diff analysis. No remote upload.
 */
export class GitIntelligence {
  private readonly importance = createChangeImportanceAnalyzer();

  constructor(private readonly bus: ProjectEventBus = createProjectEventBus()) {}

  analyzeCommitMessage(
    message: string,
    changedPaths: string[] = [],
  ): GitCommitInsight {
    const changedModules = [
      ...new Set(
        changedPaths.flatMap((p) => {
          const parts = p.replace(/\\/g, '/').split('/');
          const hints: string[] = [];
          if (parts[0] === 'packages' || parts[0] === 'apps') {
            if (parts[1]) hints.push(capitalize(parts[1]));
          }
          if (/payment/i.test(p)) hints.push('Payment');
          if (/auth/i.test(p)) hints.push('Auth');
          if (/notif/i.test(p)) hints.push('Notifications');
          if (/transaction/i.test(p)) hints.push('Transactions');
          return hints;
        }),
      ),
    ];

    if (!changedModules.length) {
      const fromMsg = message.match(/\b(payment|auth|billing|notif\w*|refund)\b/i);
      if (fromMsg) changedModules.push(capitalize(fromMsg[1]!));
    }

    const related = inferRelated(changedModules, message);
    const highPath = changedPaths.find((p) => this.importance.classify(p) === 'HIGH');
    const importance = highPath
      ? 'HIGH'
      : /migrat|refund|auth|schema|permission/i.test(message)
        ? 'HIGH'
        : 'MEDIUM';

    const suggestion =
      importance === 'HIGH'
        ? 'Create architecture memory? Review and save a decision/pattern for this change.'
        : undefined;

    return {
      message,
      changedModules,
      related,
      suggestion,
      importance,
    };
  }

  async analyzeHead(cwd: string): Promise<{
    event: ProjectEvent;
    insight: GitCommitInsight;
    paths: string[];
  } | null> {
    try {
      const { stdout: msgOut } = await execFileAsync('git', ['log', '-1', '--pretty=%s'], {
        cwd,
        windowsHide: true,
      });
      const { stdout: diffOut } = await execFileAsync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], {
        cwd,
        windowsHide: true,
      });
      const message = msgOut.trim();
      const paths = diffOut
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const insight = this.analyzeCommitMessage(message, paths);
      const event = this.bus.emit('GIT_COMMIT', {
        detail: message,
        metadata: { paths, modules: insight.changedModules },
      });
      return { event, insight, paths };
    } catch {
      return null;
    }
  }
}

function inferRelated(modules: string[], message: string): string[] {
  const related = new Set<string>();
  if (modules.includes('Payment') || /refund|payment/i.test(message)) {
    related.add('Transactions');
    related.add('Notifications');
  }
  if (modules.includes('Auth') || /auth|jwt/i.test(message)) {
    related.add('Permissions');
    related.add('Sessions');
  }
  return [...related];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function createGitIntelligence(bus?: ProjectEventBus): GitIntelligence {
  return new GitIntelligence(bus);
}
