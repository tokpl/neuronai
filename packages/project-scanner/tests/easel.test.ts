import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEaselAnalyzer, createProjectBrainBootstrap } from '../src/index.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function project(withEasel: boolean): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'neuron-easel-'));
  dirs.push(root);
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'glina-shop', dependencies: { next: '^15', react: '^19' } }));
  await writeFile(join(root, 'src', 'index.ts'), 'export const x = 1;\n');
  if (!withEasel) return root;
  const task = join(root, '.easel', 'tasks', 'task_1');
  await mkdir(task, { recursive: true });
  await mkdir(join(root, '.easel', 'auth'), { recursive: true });
  await mkdir(join(root, '.easel', 'artifacts'), { recursive: true });
  await writeFile(join(root, '.easel', 'meta.json'), JSON.stringify({ activeTaskId: 'task_1' }));
  await writeFile(
    join(task, 'task.json'),
    JSON.stringify({
      id: 'task_1',
      title: 'Sklep Glina',
      direction: {
        summary: 'Ciepły papier, terakota, szeryfowy nagłówek',
        typography: 'Georgia 118/54 px',
        color: 'papier #f4efe6, terakota #a24a2a',
        pageType: 'shop',
        rejected: ['różowy szablon'],
        creativeConcept: { idea: 'łuki jak okna pieca', signatureDetails: ['obracająca się pieczęć'] },
        motionPlan: { intensity: 'expressive', rationale: 'sklep z historią', scenes: [{ id: 'stage', effect: 'pinned scenes', trigger: 'scroll' }] },
      },
    }),
  );
  await writeFile(
    join(task, 'verification.json'),
    JSON.stringify({ weaknesses: [{ text: 'Prawdziwe zdjęcia produktów', needs: 'user' }, { text: 'Ujednolicić nagłówek', needs: 'fixable' }] }),
  );
  await writeFile(join(root, '.easel', 'screens.json'), JSON.stringify({ screens: [{ route: '/', name: 'Strona główna' }, { route: '/koszyk', name: 'Koszyk' }] }));
  await writeFile(join(root, '.easel', 'journey.json'), JSON.stringify({ journeys: [{ name: 'purchase', steps: [{ goto: '/', label: 'Strona główna' }, { click: 'a', label: 'Produkt' }] }] }));
  await writeFile(join(root, 'easel-items.json'), JSON.stringify({ items: ['product-card', 'cart-drawer', 'scroll-stage'] }));
  await writeFile(join(root, '.easel', 'auth', 'session.json'), JSON.stringify({ cookies: [{ name: 'sid', value: 'SECRET-SESSION-VALUE' }] }));
  await writeFile(join(root, '.easel', 'artifacts', 'shot.txt'), 'SECRET-ARTIFACT');
  return root;
}

describe('Easel design state', () => {
  it('turns the approved direction, motion, screens, journeys, library and open items into memories', async () => {
    const root = await project(true);
    const insight = await createEaselAnalyzer().analyze(root);
    expect(insight.present).toBe(true);
    const titles = insight.memories.map((m) => m.title);
    expect(titles.some((t) => t.startsWith('Design direction:'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Motion plan (expressive)'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Screens of the interface (2)'))).toBe(true);
    expect(titles.some((t) => t.startsWith('User journeys'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Easel library items (3)') || t.startsWith('Easel library items in this project (3)'))).toBe(true);
    const direction = insight.memories.find((m) => m.title.startsWith('Design direction:'))!;
    expect(direction.type).toBe('architecture_decision');
    expect(direction.content).toContain('terakota');
    expect(direction.content).toContain('różowy szablon');
    const open = insight.memories.find((m) => m.title.startsWith('Open items'))!;
    expect(open.content).toContain('Prawdziwe zdjęcia produktów');
    expect(open.content).not.toContain('Ujednolicić nagłówek');
    expect(insight.summary).toMatchObject({ pageType: 'shop', screens: 2, journeys: 1, libraryItems: 3, openItems: 1 });
    expect(insight.rules).toHaveLength(1);
    for (const m of insight.memories) expect(m.tags).toEqual(expect.arrayContaining(['easel', 'design']));
  });

  it('never reads the sign-in session or the screenshots', async () => {
    const root = await project(true);
    const insight = await createEaselAnalyzer().analyze(root);
    const everything = JSON.stringify(insight);
    expect(everything).not.toContain('SECRET-SESSION-VALUE');
    expect(everything).not.toContain('SECRET-ARTIFACT');
    expect(everything).not.toMatch(/auth[\\/]session/);
  });

  it('returns nothing without .easel/', async () => {
    const root = await project(false);
    const insight = await createEaselAnalyzer().analyze(root);
    expect(insight.present).toBe(false);
    expect(insight.memories).toEqual([]);
  });

  it('is part of a scan: memories, a design section in the report and nothing secret on disk', async () => {
    const root = await project(true);
    const report = await createProjectBrainBootstrap().scan({ root, mode: 'fast' });
    expect(report.memories.some((m) => m.source === 'Easel design state')).toBe(true);
    expect(report.easel?.present).toBe(true);
    expect(report.markdown).toContain('## Design system (Easel)');
    const written = await readFile(join(root, '.neuron', 'project-report.md'), 'utf8');
    expect(written).toContain('Design system (Easel)');
    expect(written).toContain('terakota');
    expect(written).not.toContain('SECRET-SESSION-VALUE');

    const plain = await project(false);
    const plainReport = await createProjectBrainBootstrap().scan({ root: plain, mode: 'fast' });
    expect(plainReport.easel).toBeUndefined();
    expect(plainReport.memories.some((m) => m.source === 'Easel design state')).toBe(false);
    expect(plainReport.markdown).not.toContain('Design system (Easel)');
  });
});
