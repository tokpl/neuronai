/**
 * Strip secrets and truncate diffs before any persistence.
 * Never store full commit patches by default.
 */
const SECRET_LINE =
  /(\b(api[_-]?key|token|password|secret|passwd)\b\s*[:=]\s*\S+|sk-[A-Za-z0-9]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

export function sanitizeDiffExcerpt(diff: string, maxLines = 40): string {
  const lines = diff.split(/\r?\n/).slice(0, maxLines);
  return lines
    .map((line) => (SECRET_LINE.test(line) ? line.replace(/=.+$/, '=[REDACTED]').replace(/sk-\S+/, '[REDACTED]') : line))
    .join('\n')
    .slice(0, 2000);
}

export function sanitizeCommitMessage(message: string): string {
  let out = message.replace(/\s+/g, ' ').trim().slice(0, 240);
  if (SECRET_LINE.test(out)) {
    out = out.replace(SECRET_LINE, '[REDACTED]');
  }
  return out;
}

export function shortCommit(commit: string): string {
  const c = commit.trim();
  return c.length > 12 ? c.slice(0, 12) : c;
}
