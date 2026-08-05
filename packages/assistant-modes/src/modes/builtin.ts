import type { NeuronMode } from '../types.js';

export const BUILTIN_MODES: NeuronMode[] = [
  {
    id: 'architect',
    name: 'Architect Mode',
    description: 'Design systems — boundaries, patterns, scalability, tradeoffs.',
    enabledCapabilities: [
      'architecture_review',
      'knowledge_graph',
      'decision_engine',
    ],
    priorityRules: [
      { id: 'boundaries', description: 'Prefer clear module boundaries', weight: 10 },
      { id: 'tradeoffs', description: 'Surface tradeoffs before implementation', weight: 9 },
      { id: 'scalability', description: 'Call out scalability risks early', weight: 8 },
    ],
    outputFormat: ['Summary', 'Evidence', 'Findings', 'Recommendations', 'Confidence'],
    requiredContext: ['architecture', 'knowledge_graph', 'decisions', 'dependencies'],
    suggestedMcpTools: [
      'neuron_architecture_review',
      'neuron_architecture_scan',
      'neuron_reason',
      'neuron_graph_query',
    ],
    cursorCommand: '/architect',
  },
  {
    id: 'code_review',
    name: 'Code Review Mode',
    description: 'Review changes — git, security, performance, architecture.',
    enabledCapabilities: [
      'git_analysis',
      'security_core',
      'performance_intelligence',
      'architecture_review',
    ],
    priorityRules: [
      { id: 'issues', description: 'List concrete issues first', weight: 10 },
      { id: 'risks', description: 'Highlight regression risks', weight: 9 },
      { id: 'suggestions', description: 'Actionable suggestions only', weight: 8 },
    ],
    outputFormat: ['Issues', 'Risks', 'Suggestions', 'Summary', 'Confidence'],
    requiredContext: ['git_diff', 'files', 'architecture', 'security_rules'],
    suggestedMcpTools: [
      'neuron_architecture_review',
      'neuron_security_check',
      'neuron_performance_review',
      'neuron_review_change',
    ],
    cursorCommand: '/review',
  },
  {
    id: 'debug',
    name: 'Debug Mode',
    description: 'Solve problems — incidents, logs, history, knowledge graph.',
    enabledCapabilities: [
      'incident_memory',
      'logs',
      'history',
      'knowledge_graph',
    ],
    priorityRules: [
      { id: 'root_cause', description: 'Seek root cause before fixes', weight: 10 },
      { id: 'evidence', description: 'Require evidence for claims', weight: 9 },
    ],
    outputFormat: ['Root cause', 'Evidence', 'Fix plan', 'Summary', 'Confidence'],
    requiredContext: ['logs', 'incidents', 'knowledge_graph', 'files'],
    suggestedMcpTools: [
      'neuron_debug_context',
      'neuron_root_cause',
      'neuron_search_incidents',
      'neuron_related_knowledge',
    ],
    cursorCommand: '/debug',
  },
  {
    id: 'security_review',
    name: 'Security Review Mode',
    description: 'Security audit — secrets, threats, recommendations.',
    enabledCapabilities: [
      'security_core',
      'secret_scanner',
      'threat_memory',
    ],
    priorityRules: [
      { id: 'secrets', description: 'Never echo raw secrets', weight: 10 },
      { id: 'severity', description: 'Rank by severity', weight: 9 },
    ],
    outputFormat: ['Threats', 'Severity', 'Recommendations', 'Summary', 'Confidence'],
    requiredContext: ['files', 'dependencies', 'security_rules'],
    suggestedMcpTools: [
      'neuron_security_scan',
      'neuron_security_check',
      'neuron_check_context',
      'neuron_threat_model',
    ],
    cursorCommand: '/security',
  },
  {
    id: 'performance',
    name: 'Performance Engineer Mode',
    description: 'Optimization — bottlenecks, impact, plan.',
    enabledCapabilities: [
      'performance_intelligence',
      'database_analysis',
      'architecture_review',
    ],
    priorityRules: [
      { id: 'measure', description: 'Prefer measured bottlenecks', weight: 10 },
      { id: 'impact', description: 'Estimate impact before optimizing', weight: 8 },
    ],
    outputFormat: ['Bottlenecks', 'Impact', 'Optimization plan', 'Summary', 'Confidence'],
    requiredContext: ['performance_signals', 'architecture', 'files'],
    suggestedMcpTools: [
      'neuron_performance_review',
      'neuron_performance_context',
      'neuron_scalability_check',
      'neuron_architecture_score',
    ],
    cursorCommand: '/performance',
  },
  {
    id: 'documentation',
    name: 'Documentation Mode',
    description: 'Create technical, architecture, and guide docs.',
    enabledCapabilities: [
      'documentation_intelligence',
      'architecture_graph',
    ],
    priorityRules: [
      { id: 'accuracy', description: 'Docs must match current architecture', weight: 10 },
      { id: 'audience', description: 'Write for developers', weight: 7 },
    ],
    outputFormat: ['Technical docs', 'Architecture docs', 'Guides', 'Summary', 'Confidence'],
    requiredContext: ['docs', 'architecture', 'knowledge_graph'],
    suggestedMcpTools: [
      'neuron_generate_docs',
      'neuron_project_documentation',
      'neuron_explain_project',
      'neuron_module_docs',
    ],
    cursorCommand: '/docs',
  },
  {
    id: 'onboarding',
    name: 'Onboarding Mentor Mode',
    description: 'Help new developers — learning path, concepts, mistakes.',
    enabledCapabilities: [
      'team_brain',
      'documentation',
      'workflow_memory',
    ],
    priorityRules: [
      { id: 'path', description: 'Give a progressive learning path', weight: 10 },
      { id: 'mistakes', description: 'Surface common mistakes early', weight: 9 },
    ],
    outputFormat: ['Learning path', 'Important concepts', 'Common mistakes', 'Summary', 'Confidence'],
    requiredContext: ['team_memory', 'docs', 'architecture'],
    suggestedMcpTools: [
      'neuron_onboarding',
      'neuron_team_context',
      'neuron_explain_project',
      'neuron_project_documentation',
    ],
    cursorCommand: '/onboarding',
  },
  {
    id: 'refactoring',
    name: 'Refactoring Mode',
    description: 'Plan code improvement — before/after, risks, migration.',
    enabledCapabilities: [
      'architecture_review',
      'technical_debt',
      'decision_engine',
    ],
    priorityRules: [
      { id: 'no_auto', description: 'Never auto-rewrite mass code', weight: 10 },
      { id: 'migration', description: 'Provide a migration plan', weight: 9 },
    ],
    outputFormat: ['Before', 'After', 'Risks', 'Migration plan', 'Summary', 'Confidence'],
    requiredContext: ['architecture', 'technical_debt', 'decisions', 'files'],
    suggestedMcpTools: [
      'neuron_refactor_plan',
      'neuron_architecture_review',
      'neuron_architecture_scan',
      'neuron_recommend',
    ],
    cursorCommand: '/refactor',
  },
];

export function getModeById(id: string): NeuronMode | undefined {
  return BUILTIN_MODES.find((m) => m.id === id);
}

export function listModes(): NeuronMode[] {
  return [...BUILTIN_MODES];
}
