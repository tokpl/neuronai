import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GeneratedMemory, SuggestedRule } from '../types.js';

/**
 * Easel (a design-engineering toolkit for Cursor/Codex) keeps the design state of an interface in `.easel/`:
 * the approved direction, the motion plan, the screen inventory, the user journeys and the verification notes.
 * This analyzer reads that state and turns it into project memories, so `neuron_context` can answer design questions
 * ("which palette, which type, which screens, which library items") in every chat, also one that never ran Easel.
 *
 * It reads a fixed set of JSON files and NEVER anything under `.easel/auth` (a live sign-in session) or
 * `.easel/artifacts` (screenshots). Without `.easel/` it returns nothing.
 */
export interface EaselInsight {
  present: boolean;
  memories: GeneratedMemory[];
  rules: SuggestedRule[];
  /** Short, human-readable section for the project report. */
  markdown: string;
  summary: { pageType?: string; direction?: string; screens: number; journeys: number; libraryItems: number; openItems: number };
}

interface TaskFile {
  id?: string;
  title?: string;
  direction?: {
    summary?: string;
    typography?: string;
    color?: string;
    composition?: string;
    identity?: string;
    pageType?: string;
    rejected?: string[];
    creativeConcept?: { idea?: string; signatureDetails?: string[] };
    motionPlan?: { intensity?: string; rationale?: string; scenes?: Array<{ id?: string; effect?: string; trigger?: string }> };
  };
}
interface VerificationFile {
  weaknesses?: Array<{ text?: string; needs?: string }>;
}

const EMPTY: EaselInsight = {
  present: false,
  memories: [],
  rules: [],
  markdown: '',
  summary: { screens: 0, journeys: 0, libraryItems: 0, openItems: 0 },
};

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const join2 = (xs: string[] | undefined, n: number): string => (xs ?? []).slice(0, n).join('; ');

const ITEM_FILES = [
  'easel-items.json',
  'src/easel/easel-items.json',
  'easel/easel-items.json',
  'public/easel/easel-items.json',
  'backend/web/easel/easel-items.json',
];

export class EaselAnalyzer {
  async analyze(root: string): Promise<EaselInsight> {
    const easelDir = join(root, '.easel');
    if (!existsSync(easelDir)) return EMPTY;

    const meta = await readJson<{ activeTaskId?: string }>(join(easelDir, 'meta.json'));
    const taskDir = meta?.activeTaskId ? join(easelDir, 'tasks', meta.activeTaskId) : null;
    const task = taskDir ? await readJson<TaskFile>(join(taskDir, 'task.json')) : null;
    const verification = taskDir ? await readJson<VerificationFile>(join(taskDir, 'verification.json')) : null;
    const screens = (await readJson<{ screens?: Array<{ route?: string; name?: string }> }>(join(easelDir, 'screens.json')))?.screens ?? [];
    const journeys =
      (await readJson<{ journeys?: Array<{ name?: string; steps?: Array<Record<string, unknown>> }> }>(join(easelDir, 'journey.json')))?.journeys ?? [];
    let items: string[] = [];
    for (const f of ITEM_FILES) {
      const parsed = await readJson<{ items?: string[] }>(join(root, f));
      if (parsed?.items?.length) {
        items = parsed.items;
        break;
      }
    }

    const d = task?.direction ?? {};
    const memories: GeneratedMemory[] = [];
    const tags = (...extra: string[]): string[] => ['easel', 'design', ...extra];
    const source = 'Easel design state';

    if (d.summary || d.creativeConcept?.idea) {
      memories.push({
        title: `Design direction: ${clip(d.summary ?? task?.title ?? 'approved direction', 70)}`,
        content: [
          d.pageType && `Page type: ${d.pageType}.`,
          d.identity && `Identity: ${d.identity}`,
          d.typography && `Typography: ${d.typography}`,
          d.color && `Colour: ${d.color}`,
          d.composition && `Composition: ${d.composition}`,
          d.creativeConcept?.idea && `Idea: ${d.creativeConcept.idea}`,
          d.creativeConcept?.signatureDetails?.length && `Signature details: ${join2(d.creativeConcept.signatureDetails, 6)}.`,
          d.rejected?.length && `Rejected, do not bring back: ${join2(d.rejected, 6)}.`,
          'Follow this direction in every change to the interface; do not restyle with new colours, fonts or a second component system.',
        ]
          .filter(Boolean)
          .join('\n'),
        type: 'architecture_decision',
        confidence: 0.9,
        source,
        tags: tags('direction', ...(d.pageType ? [d.pageType] : [])),
      });
    }

    const mp = d.motionPlan;
    if (mp?.intensity || mp?.scenes?.length) {
      memories.push({
        title: `Motion plan (${mp.intensity ?? 'defined'}): ${(mp.scenes ?? []).length} planned scene(s)`,
        content: [
          mp.intensity && `Intensity: ${mp.intensity}.`,
          mp.rationale && `Why: ${mp.rationale}`,
          ...(mp.scenes ?? []).slice(0, 6).map((s) => `Scene ${s.id ?? '?'}: ${s.effect ?? ''} (${s.trigger ?? '?'}).`),
          'Every motion keeps a readable resting state, a reduced-motion state and a phone behaviour.',
        ]
          .filter(Boolean)
          .join('\n'),
        type: 'pattern',
        confidence: 0.85,
        source,
        tags: tags('motion'),
      });
    }

    if (screens.length) {
      memories.push({
        title: `Screens of the interface (${screens.length}) in .easel/screens.json`,
        content: `${screens
          .slice(0, 60)
          .map((s) => `${s.route ?? '?'}${s.name ? ` (${s.name})` : ''}`)
          .join('; ')}.\nEvery listed screen must be built and inspected signed in; a new screen goes on the list first.`,
        type: 'knowledge',
        confidence: 0.85,
        source,
        tags: tags('screens'),
      });
    }

    if (journeys.length) {
      memories.push({
        title: `User journeys that must keep working: ${journeys.map((j) => j.name ?? '?').join(', ')}`,
        content:
          journeys
            .map((j) => `${j.name ?? '?'}: ${(j.steps ?? []).map((s) => String(s.label ?? Object.keys(s)[0])).join(' → ')}`)
            .join('\n') + '\nRun the journey after changes; the Easel gate refuses done while one fails.',
        type: 'pattern',
        confidence: 0.85,
        source,
        tags: tags('journey'),
      });
    }

    if (items.length) {
      memories.push({
        title: `Easel library items in this project (${items.length})`,
        content: `${items.slice(0, 60).join(', ')}.\nBuild with these items (their --ez-* tokens carry the look); never re-make a table, shell, dialog, chart or form field by hand and never add a parallel class prefix.`,
        type: 'dependency',
        confidence: 0.9,
        source,
        tags: tags('library'),
      });
    }

    const open = (verification?.weaknesses ?? []).filter((w) => w.needs === 'user' && w.text);
    if (open.length) {
      memories.push({
        title: `Open items that need the owner (${open.length})`,
        content: `${open
          .slice(0, 12)
          .map((w) => `- ${w.text}`)
          .join('\n')}\nThese are placeholders or unconfirmed facts; do not present them as final.`,
        type: 'knowledge',
        confidence: 0.8,
        source,
        tags: tags('needs-user'),
      });
    }

    const rules: SuggestedRule[] = [];
    if (d.summary || items.length) {
      rules.push({
        rule: 'Interface work follows the stored Easel design direction and library; do not restyle or re-make library components by hand.',
        reason: 'The project has an approved Easel design state in .easel/.',
        confidence: 0.9,
      });
    }

    const lines = [
      '## Design system (Easel)',
      '',
      d.summary ? `- Direction: ${clip(d.summary, 160)}` : null,
      d.pageType ? `- Page type: ${d.pageType}` : null,
      d.typography ? `- Typography: ${clip(d.typography, 120)}` : null,
      d.color ? `- Colour: ${clip(d.color, 120)}` : null,
      `- ${screens.length} screens, ${journeys.length} journeys, ${items.length} library items, ${open.length} open items for the owner`,
      '',
    ].filter((l): l is string => l !== null);

    return {
      present: true,
      memories,
      rules,
      markdown: lines.join('\n'),
      summary: {
        pageType: d.pageType,
        direction: d.summary ? clip(d.summary, 120) : undefined,
        screens: screens.length,
        journeys: journeys.length,
        libraryItems: items.length,
        openItems: open.length,
      },
    };
  }
}

export function createEaselAnalyzer(): EaselAnalyzer {
  return new EaselAnalyzer();
}
