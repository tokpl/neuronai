import type { DeveloperSession, TechnicalTaskMemory } from '../types.js';

export class SessionSummaryGenerator {
  markdown(input: {
    session: DeveloperSession;
    tasks?: TechnicalTaskMemory[];
    fileCount?: number;
  }): string {
    const s = input.session;
    const fileCount = input.fileCount ?? s.relatedFiles.length;
    const tasks = input.tasks ?? [];
    const important =
      s.decisions[0] ??
      (s.activeArea ? `${s.activeArea} work in progress` : 'Technical session update');

    const next =
      s.unfinishedWork[0] ??
      tasks.find((t) => t.remaining.length)?.remaining[0] ??
      'Add tests / verify critical paths';

    return [
      '# Work summary',
      '',
      '_Technical session summary — not time tracking or people analytics._',
      '',
      '## Today',
      '',
      s.summary || `Worked on ${s.activeArea}.`,
      '',
      '## Changed',
      '',
      `- ${fileCount} files`,
      ...(s.relatedFiles.slice(0, 20).map((f) => `  - ${f}`)),
      '',
      '## Important',
      '',
      important,
      ...(s.decisions.slice(0, 8).map((d) => `- ${d}`)),
      '',
      '## Next',
      '',
      next,
      ...(s.unfinishedWork.slice(0, 8).map((u) => `- ${u}`)),
      '',
      ...(s.branch ? [`## Branch`, '', s.branch, ''] : []),
    ].join('\n');
  }
}

export function createSessionSummaryGenerator(): SessionSummaryGenerator {
  return new SessionSummaryGenerator();
}
