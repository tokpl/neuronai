import type { MemoryType } from '@neuronai/types';

/**
 * User-facing Project Brain knowledge categories.
 * Storage still uses MemoryType; category is the learning UX label.
 */
export type BrainKnowledgeCategory =
  | 'project_dna'
  | 'architecture_decision'
  | 'business_rule'
  | 'coding_convention'
  | 'project_preference'
  | 'project_goal'
  | 'project_context'
  | 'important_insight'
  | 'technology_decision'
  | 'module_knowledge'
  | 'security_rule'
  | 'performance_rule';

const LABELS: Record<BrainKnowledgeCategory, string> = {
  project_dna: 'Project DNA',
  architecture_decision: 'Architecture Decision',
  business_rule: 'Business Rule',
  coding_convention: 'Coding Convention',
  project_preference: 'Project Preference',
  project_goal: 'Project Goal',
  project_context: 'Project Context',
  important_insight: 'Important Insight',
  technology_decision: 'Technology Decision',
  module_knowledge: 'Module Knowledge',
  security_rule: 'Security Rule',
  performance_rule: 'Performance Rule',
};

export function categoryLabel(category: BrainKnowledgeCategory): string {
  return LABELS[category];
}

export function memoryTypeForCategory(category: BrainKnowledgeCategory): MemoryType {
  switch (category) {
    case 'architecture_decision':
    case 'security_rule':
    case 'performance_rule':
      return 'architecture_decision';
    case 'technology_decision':
      return 'dependency';
    case 'business_rule':
      return 'business_rule';
    case 'coding_convention':
      return 'pattern';
    case 'project_context':
    case 'project_goal':
    case 'project_preference':
      return 'context';
    case 'project_dna':
    case 'module_knowledge':
    case 'important_insight':
    default:
      return 'knowledge';
  }
}

export function categoryFromMemoryType(type: MemoryType): BrainKnowledgeCategory {
  switch (type) {
    case 'architecture_decision':
      return 'architecture_decision';
    case 'business_rule':
      return 'business_rule';
    case 'pattern':
      return 'coding_convention';
    case 'dependency':
      return 'technology_decision';
    case 'context':
      return 'project_context';
    case 'mistake':
      return 'important_insight';
    case 'knowledge':
    default:
      return 'module_knowledge';
  }
}

export type ClassifySignals = {
  memoryType?: MemoryType;
  hasAuthChange?: boolean;
  hasSchemaChange?: boolean;
  hasArchitectureHint?: boolean;
  hasDependencyChange?: boolean;
  changeKind?: string;
  title?: string;
  content?: string;
  task?: string;
};

/**
 * Classify durable engineering knowledge for learning UX.
 */
export function classifyKnowledge(signals: ClassifySignals): {
  category: BrainKnowledgeCategory;
  label: string;
  memoryType: MemoryType;
} {
  const text = `${signals.title ?? ''} ${signals.content ?? ''} ${signals.task ?? ''}`.toLowerCase();

  // Prefer explicit type from workflow rules when present
  if (signals.memoryType) {
    const category = categoryFromMemoryType(signals.memoryType);
    return { category, label: categoryLabel(category), memoryType: signals.memoryType };
  }

  if (/\b(dna|stack|framework|identity)\b/.test(text) && /project/.test(text)) {
    return pack('project_dna');
  }
  if (signals.hasAuthChange || /\b(auth|oauth|rbac|permission|security)\b/.test(text)) {
    if (/\b(security|vuln|csrf|xss|inject)\b/.test(text)) return pack('security_rule');
    return pack('architecture_decision');
  }
  if (/\b(perf|latency|throughput|cache|optimize)\b/.test(text)) {
    return pack('performance_rule');
  }
  if (signals.hasSchemaChange || signals.hasArchitectureHint) {
    return pack('architecture_decision');
  }
  if (signals.hasDependencyChange || /\b(redis|postgres|openai|provider|library)\b/.test(text)) {
    return pack('technology_decision');
  }
  if (/\b(business rule|must always|never allow|policy)\b/.test(text)) {
    return pack('business_rule');
  }
  if (/\b(convention|naming|style|pattern)\b/.test(text) || signals.changeKind === 'refactor') {
    return pack('coding_convention');
  }
  if (/\b(goal|milestone|roadmap)\b/.test(text)) {
    return pack('project_goal');
  }
  if (/\b(prefer|preference|default)\b/.test(text)) {
    return pack('project_preference');
  }
  if (signals.changeKind === 'docs') {
    return pack('module_knowledge');
  }
  return pack('important_insight');
}

function pack(category: BrainKnowledgeCategory) {
  return {
    category,
    label: categoryLabel(category),
    memoryType: memoryTypeForCategory(category),
  };
}

/** Categories treated as permanent Project Brain knowledge (always worth considering). */
export function isPermanentCategory(category: BrainKnowledgeCategory): boolean {
  return (
    category === 'project_dna' ||
    category === 'architecture_decision' ||
    category === 'business_rule' ||
    category === 'technology_decision' ||
    category === 'security_rule' ||
    category === 'performance_rule' ||
    category === 'coding_convention' ||
    category === 'project_goal'
  );
}
