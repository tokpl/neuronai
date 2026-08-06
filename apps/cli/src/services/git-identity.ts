import { spawnSync } from 'node:child_process';

/** Best-effort git identity for staleness checks. Never throws. */
export function readGitIdentity(cwd: string): { head: string | null; branch: string | null } {
  const head = git(cwd, ['rev-parse', 'HEAD']);
  const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return {
    head: head && /^[0-9a-f]{7,40}$/i.test(head) ? head : null,
    branch: branch && branch !== 'HEAD' ? branch : branch === 'HEAD' ? 'DETACHED' : null,
  };
}

function git(cwd: string, args: string[]): string | null {
  try {
    const r = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (r.status !== 0) return null;
    return (r.stdout || '').trim() || null;
  } catch {
    return null;
  }
}
