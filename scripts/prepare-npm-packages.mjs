import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const version = process.argv[2] ?? '0.1.1';

const roots = [
  'c:/projekty/neuron-ai-memory/packages',
  'c:/projekty/neuron-ai-memory/apps',
];

const dirs = roots.flatMap((r) =>
  readdirSync(r, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(r, d.name)),
);

for (const dir of dirs) {
  const p = join(dir, 'package.json');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  j.version = version;
  j.publishConfig = { ...(j.publishConfig ?? {}), access: 'public' };
  j.repository = j.repository ?? {
    type: 'git',
    url: 'https://github.com/tokpl/neuronai.git',
  };
  j.homepage = j.homepage ?? 'https://github.com/tokpl/neuronai';
  j.bugs = j.bugs ?? { url: 'https://github.com/tokpl/neuronai/issues' };
  j.engines = j.engines ?? { node: '>=22' };
  j.license = j.license ?? 'Apache-2.0';

  if (j.name === 'neuronai') {
    j.description =
      'NeuronAI - CLI for Neuron - AI Memory (local-first Cursor project memory)';
  } else if (typeof j.name === 'string' && j.name.startsWith('@neuronai/')) {
    const short = j.name.slice('@neuronai/'.length);
    j.description = `NeuronAI / ${short} - package for Neuron - AI Memory`;
  }

  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('updated', j.name, version);
}
