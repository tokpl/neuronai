import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createCodebaseScanner,
  createFileImportanceAnalyzer,
  createProjectBrainBootstrap,
  createSensitiveFileDetector,
  createTechnologyDetector,
  createDependencyGraphBuilder,
  createInitialMemoryGenerator,
  createArchitectureAnalyzer,
} from '../src/index.js';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-scan-'));
  dirs.push(root);
  await mkdir(join(root, 'src', 'services'), { recursive: true });
  await mkdir(join(root, 'src', 'controllers'), { recursive: true });
  await mkdir(join(root, 'src', 'repositories'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-app',
      dependencies: {
        react: '^19',
        next: '^15',
        '@prisma/client': '^6',
        express: '^4',
      },
    }),
    'utf8',
  );
  await writeFile(join(root, 'tsconfig.json'), '{}', 'utf8');
  await writeFile(join(root, 'docker-compose.yml'), 'services:\n  db:\n    image: postgres\n', 'utf8');
  await writeFile(
    join(root, 'README.md'),
    '# Fixture\n\n- Uses modular services\n- PostgreSQL backend\n',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'services', 'PaymentService.ts'),
    `import { Outbox } from './Outbox';\nexport class PaymentService {}\n`,
    'utf8',
  );
  await writeFile(join(root, 'src', 'services', 'UserService.ts'), `export class UserService {}\n`, 'utf8');
  await writeFile(
    join(root, 'src', 'services', 'AuthService.ts'),
    `export class AuthService { /* jwt */ }\n`,
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'controllers', 'PaymentController.ts'),
    `import { PaymentService } from '../services/PaymentService';\nexport class PaymentController {}\n`,
    'utf8',
  );
  await writeFile(join(root, '.env'), 'SECRET=nope', 'utf8');
  await writeFile(join(root, 'src', 'repositories', 'PaymentRepository.ts'), 'export {}\n', 'utf8');
  return root;
}

describe('file filtering & security', () => {
  it('classifies importance and blocks secrets', () => {
    const imp = createFileImportanceAnalyzer();
    expect(imp.classify('src/services/A.ts')).toBe('HIGH');
    expect(imp.classify('docs/guide.md')).toBe('MEDIUM');
    expect(imp.isIgnoredDir('node_modules')).toBe(true);

    const sens = createSensitiveFileDetector();
    expect(sens.isSensitive('.env')).toBe(true);
    expect(sens.isSensitive('id_rsa')).toBe(true);
    expect(sens.isSensitive('src/app.ts')).toBe(false);
  });
});

describe('stack & graph', () => {
  it('detects stack and builds USES edges', async () => {
    const root = await fixture();
    const stack = await createTechnologyDetector().detect(root);
    expect(stack.frontend.join(' ')).toMatch(/React|Next/i);
    expect(stack.tools.join(' ')).toMatch(/Docker|Prisma/i);

    const graph = await createDependencyGraphBuilder().build(root, stack);
    expect(graph.some((e) => e.relation === 'USES' || e.relation === 'DEPENDS_ON')).toBe(true);
  });
});

describe('memory generation', () => {
  it('creates high-confidence bootstrap memories', async () => {
    const root = await fixture();
    const walk = await createCodebaseScanner().walk(root, { maxFiles: 1000 });
    expect(walk.files.some((f) => f.relativePath === '.env')).toBe(false);

    const stack = await createTechnologyDetector().detect(root);
    const architecture = createArchitectureAnalyzer().analyze(walk.files);
    const dependencyGraph = await createDependencyGraphBuilder().build(root, stack);
    const memories = createInitialMemoryGenerator().generate({
      stack,
      architecture,
      dependencyGraph,
      git: { commitsSampled: 0, authors: [], branches: [], potentialDecisions: [] },
      docs: { readmeSummary: 'Fixture app', docFiles: [], knowledgeBullets: [] },
    });
    expect(memories.length).toBeGreaterThan(0);
    expect(memories.some((m) => m.confidence >= 0.9)).toBe(true);
  });
});

describe('bootstrap scan', () => {
  it('writes project brain artifacts', async () => {
    const root = await fixture();
    const report = await createProjectBrainBootstrap().scan({
      root,
      mode: 'deep',
      projectName: 'Fixture SaaS',
    });
    expect(report.markdown).toMatch(/Neuron Project Report/);
    expect(report.memoriesCreated).toBeGreaterThan(0);
    expect(report.architecture.services.length).toBeGreaterThan(0);
    expect(report.constitutionMarkdown).toMatch(/Suggested Constitution/);
  });
});
