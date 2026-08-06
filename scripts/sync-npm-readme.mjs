import { readFile, writeFile } from 'node:fs/promises';

/**
 * The npm page cannot resolve repo-relative links, so the CLI README is the root
 * README with absolute URLs. Generated rather than maintained by hand.
 */
const BLOB = 'https://github.com/tokpl/neuronai/blob/main/';
const RAW = 'https://raw.githubusercontent.com/tokpl/neuronai/main/';

const md = (await readFile('README.md', 'utf8'))
  .replace(/src="\.\/([^"]+)"/g, (_m, path) => `src="${RAW}${path}"`)
  .replace(/\]\(\.\/([^)]+)\)/g, (_m, path) => `](${BLOB}${path})`);

await writeFile('apps/cli/README.md', md, 'utf8');
console.log('apps/cli/README.md synced from README.md');
