import type { QueryIntent } from './retrieval/intent.js';
import type { RetrievalDoc } from './retrieval/rank.js';
import type { ModificationAdvice } from './retrieval/recommend.js';
import type { BrainPrefs, DeliverPlaybook } from './models.js';

/** Option shaped for Cursor AskQuestion / chat fallback. */
export interface ClarifyOption {
  id: string;
  label: string;
}

/** One clarifying question (agent asks one at a time). */
export interface ClarifyQuestion {
  id: string;
  title: string;
  prompt: string;
  options: ClarifyOption[];
}

/** Hard stop before coding when Brain says so. */
export interface ContextGate {
  required: boolean;
  reason: string;
  /** What must happen before the agent writes application code. */
  until: 'clarify-answered' | 'prime-recommended';
}

/** AskQuestion payload for the first clarify question. */
export interface ClarifyAskQuestion {
  title: string;
  prompt: string;
  options: ClarifyOption[];
}

export interface ClarifyPlan {
  questions: ClarifyQuestion[];
  gate: ContextGate | null;
  /** First question only — same shape as after_task AskQuestion. */
  askQuestion: ClarifyAskQuestion | null;
  /** Soft nudge toward neuron init / neuron prime refresh when Brain is thin. */
  recommendPrime: boolean;
  /** Detected or asked playbook mode for /neuron-deliver. */
  playbook?: DeliverPlaybook;
  /**
   * Brain already has a start path — skip the long grill; still honor gates if any.
   * Agents may jump to a short blueprint + board (express deliver).
   */
  express?: boolean;
}

export interface BuildClarifyInput {
  task: string;
  intent: QueryIntent;
  docs: RetrievalDoc[];
  prefs?: BrainPrefs | null;
  recommendation?: ModificationAdvice;
  /** Map entry count when known (falls back to counting location docs). */
  mapEntryCount?: number;
}

const TRIVIAL =
  /\b(typo|rename|comment|whitespace|one[- ]line|one[- ]liner|fix lint|format)\b/i;

const VAGUE_BUILD =
  /^(add|implement|build|create|make|ship)\b.{0,80}$/i;

const MULTI_FILE_HINT =
  /\b(end[- ]to[- ]end|plan and build|migration|refactor|oauth|auth|payment|billing|multi[- ]file|deliver)\b/i;

const PLAYBOOK_UI =
  /\b(ui|ux|css|tailwind|layout|landing|pricing page|button|component style|visual|design system)\b/i;
const PLAYBOOK_DOCS =
  /\b(docs?|readme|tutorial|how[- ]to|diátaxis|diataxis|changelog|adr)\b/i;
const PLAYBOOK_POLISH =
  /\b(simplify|polish|tidy|cleanup|clean up|reduce complexity|dead code|refactor this)\b/i;
const PLAYBOOK_MAINTAIN =
  /\b(dependenc|upgrade|cve|vulnerab|harden|lint debt|type ?error|flaky|deflake|prune)\b/i;

const MAX_QUESTIONS = 7;

function isKnowledge(doc: RetrievalDoc): boolean {
  return doc.kind !== 'location';
}

function countKnowledge(docs: RetrievalDoc[]): {
  memories: number;
  decisions: number;
  rules: number;
  locations: number;
} {
  let memories = 0;
  let decisions = 0;
  let rules = 0;
  let locations = 0;
  for (const d of docs) {
    if (d.kind === 'location') locations += 1;
    else if (d.kind === 'decision') decisions += 1;
    else if (d.kind === 'rule') rules += 1;
    else if (isKnowledge(d)) memories += 1;
  }
  return { memories, decisions, rules, locations };
}

function hasWorkflowPrefs(prefs: BrainPrefs | null | undefined): boolean {
  if (!prefs) return false;
  const workflow = prefs['workflow'];
  return Boolean(workflow && typeof workflow === 'object');
}

/** Infer deliver playbook from task text (Brain can override via clarify). */
export function detectPlaybook(task: string): DeliverPlaybook {
  if (PLAYBOOK_UI.test(task)) return 'ui';
  if (PLAYBOOK_DOCS.test(task)) return 'docs';
  if (PLAYBOOK_POLISH.test(task)) return 'polish';
  if (PLAYBOOK_MAINTAIN.test(task)) return 'maintain';
  return 'build';
}

function playbookAmbiguous(task: string): boolean {
  const hits = [PLAYBOOK_UI, PLAYBOOK_DOCS, PLAYBOOK_POLISH, PLAYBOOK_MAINTAIN].filter((r) =>
    r.test(task),
  ).length;
  return hits >= 2;
}

/**
 * Deterministic gap → clarify questions. Max 7; AskQuestion uses the first.
 * Skip / express when Brain already has enough signal or the task is trivial.
 */
export function buildClarifyPlan(input: BuildClarifyInput): ClarifyPlan {
  const task = input.task.trim();
  const questions: ClarifyQuestion[] = [];
  let recommendPrime = false;
  let gate: ContextGate | null = null;
  const playbook = detectPlaybook(task);

  if (!task || TRIVIAL.test(task)) {
    return {
      questions: [],
      gate: null,
      askQuestion: null,
      recommendPrime: false,
      playbook: 'build',
      express: true,
    };
  }

  const counts = countKnowledge(input.docs);
  const mapCount = input.mapEntryCount ?? counts.locations;
  const knowledgeTotal = counts.memories + counts.decisions + counts.rules;
  const brainThin = knowledgeTotal < 3 || mapCount < 2;
  const workflowMissing = !hasWorkflowPrefs(input.prefs);
  const brainRich = knowledgeTotal >= 5 && mapCount >= 2 && Boolean(input.recommendation);

  const needsClarifyIntent =
    input.intent === 'MODIFICATION' ||
    input.intent === 'ARCHITECTURE' ||
    input.intent === 'GENERAL_PROJECT';

  const vague =
    VAGUE_BUILD.test(task) ||
    (needsClarifyIntent && task.split(/\s+/).length <= 8 && !input.recommendation);

  const multiFile =
    MULTI_FILE_HINT.test(task) ||
    input.intent === 'ARCHITECTURE' ||
    (input.intent === 'MODIFICATION' && MULTI_FILE_HINT.test(task));

  const deepGrill = needsClarifyIntent && (vague || multiFile || playbook !== 'build');

  // --- Thin Brain cold-start (advantage vs Absolute: we diagnose emptiness) ---
  if (brainThin || workflowMissing) {
    recommendPrime = true;
    questions.push({
      id: 'prime',
      title: '🧠 Neuron · Thin Brain',
      prompt: [
        'Project Brain looks thin (few decisions/map entries or missing workflow prefs).',
        'Neuron Deliver is strongest after `neuron init` (conventions + map). Absolute would guess — we will not.',
        '',
        'What should we do?',
      ].join('\n'),
      options: [
        { id: 'prime-now', label: 'Init/prime first (Recommended)' },
        { id: 'scan-deep', label: 'neuron_scan deep now, then continue' },
        { id: 'continue', label: 'Continue with a deeper interview anyway' },
      ],
    });
  }

  const seedPath = input.recommendation?.path?.trim() ?? '';
  const seedInDocs = Boolean(
    seedPath &&
      input.docs.some(
        (d) =>
          d.kind === 'location' &&
          (d.location?.path === seedPath || d.location?.path?.endsWith(seedPath)),
      ),
  );
  const architectureWithoutDecisions =
    input.intent === 'ARCHITECTURE' && counts.decisions === 0;
  // Safer express: rich Brain + recommendation path grounded in map/docs.
  if (
    brainRich &&
    seedPath &&
    seedInDocs &&
    !brainThin &&
    !workflowMissing &&
    !architectureWithoutDecisions
  ) {
    return {
      questions: [],
      gate: null,
      askQuestion: null,
      recommendPrime: false,
      playbook,
      express: true,
    };
  }

  // Playbook when ambiguous or deliver-shaped without clear mode
  if (deepGrill && (playbookAmbiguous(task) || (multiFile && playbook === 'build' && vague))) {
    questions.push({
      id: 'playbook',
      title: '🧠 Neuron · Deliver mode',
      prompt: [
        `Task: ${task}`,
        '',
        `Detected mode: **${playbook}**. Pick the playbook Neuron should run inside /neuron-deliver (not separate Absolute skills).`,
      ].join('\n'),
      options: [
        { id: 'build', label: 'Build — feature / bug / migration (Recommended)' },
        { id: 'ui', label: 'UI — intentional layout / craft' },
        { id: 'docs', label: 'Docs — truthful docs from Brain' },
        { id: 'polish', label: 'Polish — simplify working diff' },
        { id: 'maintain', label: 'Maintain — deps / harden / trim / stabilize' },
      ],
    });
  }

  if (needsClarifyIntent && (vague || multiFile) && !input.recommendation) {
    const locationHints = input.docs
      .filter((d) => d.kind === 'location' && d.location?.path)
      .slice(0, 3)
      .map((d) => `\`${d.location!.path}\``);
    const decisionHints = input.docs
      .filter((d) => d.kind === 'decision')
      .slice(0, 2)
      .map((d) => `“${d.title}”`);
    const grounded = [
      locationHints.length
        ? `Brain map hints: ${locationHints.join(', ')}. Prefer these over inventing paths.`
        : 'Brain has no clear start path for this change. Pick the best scope before coding.',
      decisionHints.length ? `Related decisions: ${decisionHints.join('; ')}.` : null,
    ]
      .filter(Boolean)
      .join('\n');
    questions.push({
      id: 'scope',
      title: '🧠 Neuron · Scope',
      prompt: [`Task: ${task}`, '', grounded].join('\n'),
      options: [
        {
          id: 'minimal',
          label: locationHints[0]
            ? `Minimal change near ${locationHints[0]} (Recommended)`
            : 'Minimal change — smallest safe slice (Recommended)',
        },
        locationHints[1]
          ? { id: 'module', label: `Focus on ${locationHints[1]}` }
          : { id: 'module', label: 'One module/feature area only' },
        { id: 'cross-cutting', label: 'Cross-cutting (middleware / shared layer)' },
        { id: 'design-first', label: 'Design first — blueprint, no code yet' },
      ],
    });
  }

  if (needsClarifyIntent && vague && counts.decisions === 0) {
    const moduleHints = input.docs
      .filter((d) => d.kind === 'location' && d.location?.kind === 'module')
      .slice(0, 2);
    questions.push({
      id: 'ownership',
      title: '🧠 Neuron · Ownership',
      prompt: [
        `Task: ${task}`,
        '',
        moduleHints.length
          ? `No architecture decisions yet. Candidate modules from Brain: ${moduleHints
              .map((d) => `\`${d.location?.path ?? d.title}\``)
              .join(', ')}.`
          : 'No architecture decisions in Brain for this area. Where should ownership live?',
      ].join('\n'),
      options: [
        {
          id: 'follow-existing',
          label: moduleHints[0]
            ? `Own in ${moduleHints[0].location?.path ?? moduleHints[0].title} (Recommended)`
            : 'Follow nearest existing module (Recommended)',
        },
        { id: 'new-module', label: 'New module / package' },
        { id: 'unsure', label: "Not sure — propose options after a short look" },
      ],
    });
  }

  // Depth Absolute-style: acceptance + risk (Brain-grounded when possible)
  if (deepGrill) {
    const taskTokens = new Set(
      task
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((t) => t.length > 3),
    );
    const matchingDecision = input.docs.find((d) => {
      if (d.kind !== 'decision' || (d.importance ?? 0) < 0.6) return false;
      const hay = `${d.title} ${d.content}`.toLowerCase();
      let hits = 0;
      for (const t of taskTokens) {
        if (hay.includes(t)) hits += 1;
      }
      return hits >= 2;
    });
    const decisionHint = matchingDecision ?? input.docs.find((d) => d.kind === 'decision');

    // Skip acceptance when a high-importance decision already covers the task.
    if (!matchingDecision) {
      questions.push({
        id: 'acceptance',
        title: '🧠 Neuron · Done looks like',
        prompt: [
          `Task: ${task}`,
          '',
          decisionHint
            ? `Existing Brain decision: “${decisionHint.title}”. What is the acceptance bar for this change?`
            : 'What does done look like before we write a board?',
        ].join('\n'),
        options: [
          {
            id: 'tests-green',
            label: 'Project tests/lint green + matches blueprint (Recommended)',
          },
          { id: 'behavior', label: 'User-visible behavior change only (light verify)' },
          { id: 'docs-only', label: 'Docs/spec approved — code optional this pass' },
          { id: 'spike', label: 'Spike / spike PR — learn, may throw away' },
        ],
      });
    }

    questions.push({
      id: 'risk',
      title: '🧠 Neuron · Blast radius',
      prompt: [
        `Task: ${task}`,
        '',
        'How wide is the blast radius? Neuron will size waves and gates from this.',
      ].join('\n'),
      options: [
        { id: 'local', label: 'Local — one package/module (Recommended)' },
        { id: 'shared', label: 'Touches shared / middleware / public API' },
        { id: 'data', label: 'Data / migrations / billing / auth sensitive' },
        { id: 'unknown', label: 'Unknown — inspect first, then re-gate' },
      ],
    });

    questions.push({
      id: 'out-of-scope',
      title: '🧠 Neuron · Out of scope',
      prompt: [
        `Task: ${task}`,
        '',
        'What must we explicitly NOT do this pass?',
      ].join('\n'),
      options: [
        { id: 'no-deps', label: 'No dependency upgrades (Recommended)' },
        { id: 'no-refactors', label: 'No drive-by refactors outside wave paths' },
        { id: 'no-ui', label: 'No UI / copy changes' },
        { id: 'narrow-only', label: 'Only what acceptance requires — everything else out' },
      ],
    });
  }

  const capped = questions.slice(0, MAX_QUESTIONS);

  if (capped.length > 0 && (vague || multiFile || brainThin || deepGrill)) {
    gate = {
      required: true,
      reason: brainThin
        ? 'Brain is thin or prefs incomplete — clarify (and consider init/prime) before coding'
        : 'Ambiguous or multi-file change — answer clarify before writing application code',
      until: brainThin && capped[0]?.id === 'prime' ? 'prime-recommended' : 'clarify-answered',
    };
  }

  const first = capped[0];
  const askQuestion: ClarifyAskQuestion | null = first
    ? { title: first.title, prompt: first.prompt, options: first.options }
    : null;

  return {
    questions: capped,
    gate,
    askQuestion,
    recommendPrime,
    playbook,
    express: capped.length === 0,
  };
}
