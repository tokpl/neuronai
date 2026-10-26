import type { CodeIntelligence, MemoryRecord } from '@neuronai/types';

export type {
  CodeEdge,
  CodeEdgeType,
  CodeEvidence,
  CodeFileNode,
  CodeIntelligence,
  CodeSymbolKind,
  CodeSymbolNode,
  RelationConfidence,
} from '@neuronai/types';

/** Provenance for a DNA facet claim. */
export interface Provenance {
  kind: string;
  ref?: string;
  note?: string;
}

export type FacetSource = 'detect' | 'user' | 'evolve';

/** Single DNA claim with confidence + evidence. */
export interface Facet<T> {
  value: T;
  confidence: number;
  evidence: Provenance[];
  updatedAt: string;
  source: FacetSource;
}

export interface DnaIdentity {
  kind?: Facet<string>;
  audience?: Facet<string>;
  scale?: Facet<string>;
  businessDomain?: Facet<string>;
  projectId?: Facet<string>;
  name?: Facet<string>;
}

export interface DnaStack {
  language?: Facet<string>;
  framework?: Facet<string>;
  runtime?: Facet<string>;
  packageManager?: Facet<string>;
  /** Flattened stack tags (e.g. nextjs, typescript). */
  tags?: Facet<string[]>;
}

export interface DnaStructure {
  style?: Facet<string>;
  modules?: Facet<string[]>;
  entryPoints?: Facet<string[]>;
  boundaries?: Facet<string[]>;
}

export interface DnaPlatforms {
  api?: Facet<string>;
  auth?: Facet<string>;
  data?: Facet<string>;
  validation?: Facet<string>;
  test?: Facet<string>;
  deploy?: Facet<string>;
  ui?: Facet<string>;
  async?: Facet<string>;
}

export interface DnaConventions {
  naming?: Facet<string>;
  patterns?: Facet<string[]>;
  antiPatterns?: Facet<string[]>;
}

export interface DnaRisk {
  criticalModules?: Facet<string[]>;
  hotspots?: Facet<string[]>;
  highRiskAreas?: Facet<string[]>;
}

export interface DnaMeta {
  generatedAt: string;
  scanId?: string;
  overallConfidence: number;
  summary?: string;
}

/** Project DNA — identity of the software inside the Brain. */
export interface ProjectDna {
  version: 1;
  identity: DnaIdentity;
  stack: DnaStack;
  structure: DnaStructure;
  platforms: DnaPlatforms;
  conventions: DnaConventions;
  risk: DnaRisk;
  meta: DnaMeta;
}

export interface KnowledgeGraph {
  nodes: unknown[];
  edges: unknown[];
  changes?: unknown[];
}

export type ProjectMapKind = 'module' | 'file' | 'symbol' | 'route';

/**
 * One thing the project contains, and where it actually lives.
 *
 * `path` is always repository-relative and complete — never a bare filename.
 * Answering "where is X?" is the whole reason this exists.
 */
export interface ProjectMapEntry {
  kind: ProjectMapKind;
  /** Module name, file path, symbol name, or "POST /api/users". */
  name: string;
  /** Repository-relative path. Directories end with `/`. */
  path: string;
  /** Short human description, when the scanner can infer one honestly. */
  purpose?: string;
  /** Owning module name, when known. */
  module?: string;
  /** Canonical concepts this entry relates to (see retrieval/concepts). */
  concepts?: string[];
}

/**
 * Where things are. Rebuilt by `neuron scan`, so deleted files disappear
 * instead of lingering as confidently wrong locations.
 */
export interface ProjectMap {
  version: 1;
  updatedAt: string;
  entries: ProjectMapEntry[];
}

/**
 * Single knowledge plane (`.neuron/brain/knowledge.json`).
 * The graph and the project map live here too — not in parallel files.
 */
export interface KnowledgePlane {
  version: 1;
  updatedAt: string;
  memory: MemoryRecord[];
  decisions: MemoryRecord[];
  rules: Array<{ id: string; title: string; body: string; critical?: boolean }>;
  graph: KnowledgeGraph;
  map?: ProjectMap;
  /**
   * Structural code intelligence (symbols, verified relationships, summaries).
   * Lives in the same knowledge plane — not a second index.
   */
  code?: CodeIntelligence;
}

export interface ProjectHealth {
  version: 1;
  updatedAt: string;
  score: number;
  dnaFresh: boolean;
  knowledgeFresh: boolean;
  architectureHealthy: boolean;
  notes: string[];
}

/**
 * Playbook mode inside /neuron-deliver (not separate Absolute skills).
 * Visual/device proof for bug lists lives on runbook `feedback`, not a playbook.
 * Legacy boards may still say playbook "mobile" — treat as ui + feedback.
 */
export type DeliverPlaybook = 'build' | 'ui' | 'docs' | 'polish' | 'maintain' | 'mobile';

/** Feedback triage item on the deliver board (runbook feedback). */
export type FeedbackItemStatus =
  | 'pending_triage'
  | 'reproducing'
  | 'confirmed'
  | 'cannot_repro'
  | 'by_design'
  | 'needs_info'
  | 'fixed'
  | 'verified';

export interface FeedbackItem {
  id: string;
  text: string;
  status: FeedbackItemStatus;
  evidenceBefore?: string[];
  evidenceAfter?: string[];
  verdictNote?: string;
  /** What the agent asked the user when status is needs_info. */
  askPrompt?: string;
  /** User clarification — required before fixing that item. */
  userAnswer?: string;
  /** flutter | web | php | unknown — how evidence was / will be captured. */
  surface?: 'flutter' | 'web' | 'php' | 'unknown';
}

/** Workflow prefs used by prime / deliver / verify (Brain-owned, not Absolute config). */
export interface WorkflowPrefs {
  outputStyle?: 'normal' | 'terse';
  autonomy?: 'gate-all' | 'auto-low-risk';
  tdd?: 'strict' | 'pragmatic';
  specDir?: string;
  /** Enabled deliver playbooks (default: all). */
  families?: DeliverPlaybook[];
  /** Project scripts in their own form (e.g. `pnpm test`). */
  scripts?: {
    test?: string;
    lint?: string;
    typecheck?: string;
    format?: string;
    build?: string;
    /** Device smoke / DEEP e2e (Flutter etc.). */
    mobileVerify?: string;
    /** Screenpack / adb capture harness. */
    mobileScreenpack?: string;
  };
  /** Preferred adb serial (physical phone or emulator). */
  deviceId?: string;
  /** Override evidence root; default `.neuron/workflow/evidence`. */
  mobileEvidenceDir?: string;
  packageManager?: string;
  defaultBranch?: string;
  primedAt?: string;
  /**
   * User already answered the Thin Brain clarify (continue / scan / prime).
   * Stops re-opening the same hard gate every neuron_context call.
   */
  thinBrainAcknowledgedAt?: string;
}

/** Init answers / local prefs (`.neuron/prefs.json`). */
export interface BrainPrefs {
  schemaVersion: number;
  project: {
    id: string;
    name: string;
    stack: string[];
  };
  privacy: {
    mode: 'suggest' | 'automatic' | 'manual';
    localOnly: boolean;
    telemetry: boolean;
  };
  memory: {
    autoSave: boolean;
    threshold: number;
  };
  integrations?: {
    cursor?: boolean;
  };
  /** Workflow prefs written by neuron init / prime (used by /neuron-deliver). */
  workflow?: WorkflowPrefs;
  [key: string]: unknown;
}

/** Quality signals — deliver’s answer to “did the agent honor the loop?” */
export interface DeliverSignals {
  gatesHonored?: boolean;
  verifyOk?: boolean;
  /** Playbook checklist satisfied before verifyOk. */
  checklistOk?: boolean;
  /**
   * Evidence: checklist item ids completed (must cover full playbookChecklist).
   * checklistOk is rejected unless this is complete — not an honor flag.
   */
  checklistDone?: string[];
  /** Optional notes per checklist id (what was verified). */
  checklistNotes?: Record<string, string>;
  wavesCompleted?: number;
  wavesTotal?: number;
  express?: boolean;
  clarifyQuestionCount?: number;
  proposeWavesUsed?: boolean;
  /** propose_waves quality: code graph vs map vs generic template. */
  proposeQuality?: 'code' | 'map' | 'generic';
  /** Thin runbook scenario applied when proposing waves. */
  runbook?: 'feature' | 'incident' | 'enterprise-change' | 'feedback';
  /** Soft hint that mobile playbook should pair with this board. */
  playbookHint?: DeliverPlaybook;
  /** Parsed feedback list for runbook feedback. */
  feedbackItems?: FeedbackItem[];
  rememberedAt?: string;
  completedAt?: string;
}

/** Persisted pre-execute gate under `.neuron/workflow/gate.json`. */
export interface DeliverGateState {
  version: 1;
  required: true;
  reason: string;
  until: 'clarify-answered' | 'prime-recommended';
  questionIds: string[];
  answeredIds: string[];
  task?: string;
  playbook?: DeliverPlaybook;
  createdAt: string;
  updatedAt: string;
}

/** Resumable deliver board under `.neuron/workflow/board.json`. */
export interface WorkflowBoard {
  version: 1;
  updatedAt: string;
  goal: string;
  phase:
    | 'clarify'
    | 'blueprint'
    | 'decompose'
    | 'execute'
    | 'verify'
    | 'converge'
    | 'completed';
  status: 'active' | 'blocked' | 'completed';
  /** Active playbook for this deliver (build/ui/docs/polish/maintain). */
  playbook?: DeliverPlaybook;
  waves: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'done' | 'blocked';
    /** Wave ids that must be done first (board engine). */
    dependsOn?: string[];
    /** File/module paths this wave owns (from Brain map when possible). */
    paths?: string[];
    tasks: string[];
  }>;
  scripts?: WorkflowPrefs['scripts'];
  /** Short approved blueprint (goal / approach / ownership) — survives resume. */
  blueprint?: string;
  /** Clarify answers already resolved via neuron_resolve_clarify. */
  clarifyAnswers?: Array<{ questionId: string; answer: string }>;
  /** Brain decisions / memories / modules this deliver is grounded in. */
  brainRefs?: string[];
  /** Set true after neuron_after_task ran for this board’s converge. */
  remembered?: boolean;
  /** Loop quality signals (advantage vs Absolute’s silent skip). */
  signals?: DeliverSignals;
}

export interface BrainPaths {
  projectRoot: string;
  neuronDir: string;
  prefs: string;
  projectMap: string;
  workflowDir: string;
  workflowBoard: string;
  workflowGate: string;
  workflowHistory: string;
  /** Device/screenshot evidence for mobile + feedback verify. */
  workflowEvidence: string;
  /** Human-readable feedback triage artifacts (FEEDBACK.md, OPEN_QUESTIONS.md). */
  workflowFeedback: string;
  memoryDir: string;
  brainDir: string;
  dna: string;
  knowledge: string;
  health: string;
  runtimeDir: string;
  store: string;
  cacheDir: string;
}

/** User-facing `neuron brain` summary. */
export interface BrainStatus {
  healthPercent: number;
  dnaUpdated: boolean;
  knowledgeUpdated: boolean;
  architectureHealthy: boolean;
  confidencePercent: number;
  memoryCount: number;
  decisionCount: number;
}
