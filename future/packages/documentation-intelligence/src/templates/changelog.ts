export function changelogTemplate(input: {
  added: string[];
  changed: string[];
  fixed: string[];
}): string {
  const date = new Date().toISOString().slice(0, 10);
  return [
    `# Changelog`,
    '',
    `## ${date}`,
    '',
    '### Added',
    '',
    ...(input.added.length ? input.added.map((a) => `- ${a}`) : ['- (none)']),
    '',
    '### Changed',
    '',
    ...(input.changed.length ? input.changed.map((c) => `- ${c}`) : ['- (none)']),
    '',
    '### Fixed',
    '',
    ...(input.fixed.length ? input.fixed.map((f) => `- ${f}`) : ['- (none)']),
    '',
  ].join('\n');
}
