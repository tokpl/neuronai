import { z } from 'zod';

export const projectIdSchema = z.string().min(1).optional();

export const getContextSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  files: z.array(z.string()).optional(),
};

export const searchMemorySchema = {
  projectId: projectIdSchema,
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
};

export const saveDecisionSchema = {
  projectId: projectIdSchema,
  title: z.string().min(1),
  problem: z.string().min(1),
  decision: z.string().min(1),
  reason: z.string().min(1),
  alternatives: z.array(z.string()).optional(),
};

export const storeMemorySchema = {
  projectId: projectIdSchema,
  type: z.enum(['knowledge', 'pattern', 'mistake', 'business_rule', 'dependency', 'context']),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
};

export const reviewMemorySchema = {
  projectId: projectIdSchema,
  text: z.string().min(1),
};

export const updateMemorySchema = {
  projectId: projectIdSchema,
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  reason: z.string().min(1),
};

export const projectSummarySchema = {
  projectId: projectIdSchema,
};

export const startTaskSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  files: z.array(z.string()).optional(),
};

export const ingestEventSchema = {
  projectId: projectIdSchema,
  type: z.enum([
    'ProjectOpened',
    'AgentStartedTask',
    'CodeChanged',
    'FileCreated',
    'FileDeleted',
    'GitCommitted',
    'PullRequestCreated',
    'ArchitectureChanged',
    'DocumentationChanged',
    'TaskCompleted',
  ]),
  source: z.enum(['agent', 'cli', 'git', 'ide', 'mcp', 'hook', 'system']).optional(),
  payload: z.record(z.unknown()).optional(),
};

export const afterTaskSchema = {
  projectId: projectIdSchema,
  task: z.string().optional(),
  summary: z.string().optional(),
  diff: z.string().optional(),
  files: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
};

export const resolveSuggestionSchema = {
  projectId: projectIdSchema,
  action: z.enum([
    'save',
    'edit',
    'ignore',
    'yes',
    'y',
    'remember',
    'no',
    'n',
    'skip',
    'rephrase',
  ]),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  type: z
    .enum([
      'architecture_decision',
      'knowledge',
      'pattern',
      'mistake',
      'business_rule',
      'dependency',
      'context',
    ])
    .optional(),
};

export const suggestChangesSchema = {
  projectId: projectIdSchema,
  diff: z.string().optional(),
  files: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
  task: z.string().optional(),
};

export const prepareTaskSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  mode: z.enum(['fast', 'standard', 'architect', 'debug']).optional(),
};

export const reviewArchitectureSchema = {
  projectId: projectIdSchema,
  changeDescription: z.string().min(1),
};

export const analyzeImpactSchema = {
  projectId: projectIdSchema,
  target: z.string().min(1),
};

export const generatePlanSchema = {
  projectId: projectIdSchema,
  featureRequest: z.string().min(1),
  mode: z.enum(['fast', 'standard', 'architect', 'debug']).optional(),
};

export const projectQuestionSchema = {
  projectId: projectIdSchema,
  question: z.string().min(1),
};

export const completeTaskSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  outcome: z.enum(['success', 'partial', 'failed']),
  summary: z.string().optional(),
};

export const suggestRuleSchema = {
  scanFiles: z.boolean().optional(),
};

export const reviewEvolutionSchema = {
  commitsSinceReview: z.number().int().nonnegative().optional(),
};

export const acceptConstitutionRuleSchema = {
  ruleId: z.string().min(1),
  asCritical: z.boolean().optional(),
};

export const deepSearchSchema = {
  task: z.string().min(1),
  mode: z.enum(['fast', 'standard', 'architect', 'debug', 'refactor']).optional(),
};

export const optimizeContextSchema = {
  task: z.string().min(1),
  mode: z.enum(['fast', 'standard', 'architect', 'debug', 'refactor']).optional(),
};

export const explainContextSchema = {
  task: z.string().min(1),
  mode: z.enum(['fast', 'standard', 'architect', 'debug', 'refactor']).optional(),
};

export const architectureContextSchema = {
  task: z.string().optional(),
};

export const teamContextSchema = {
  query: z.string().min(1),
  actorId: z.string().optional(),
};

export const onboardingSchema = {
  actorId: z.string().optional(),
};

export const decisionHistorySchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const teamDecisionsSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const teamRulesSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const contributorsSchema = {
  limit: z.number().int().positive().max(100).optional(),
};

export const reviewQueueSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const cleanupSuggestionsSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const memoryConflictsSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const memoryReviewSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const memoryCleanupSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const scanProjectSchema = {
  mode: z.enum(['fast', 'deep', 'architecture', 'update']).optional(),
};

export const projectChangesSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const pendingMemoriesSchema = {
  limit: z.number().int().positive().max(200).optional(),
};

export const architectSchema = {
  request: z.string().min(1),
  mode: z.enum(['NORMAL', 'ARCHITECT', 'REVIEW', 'DEBUG']).optional(),
};

export const createPlanSchema = {
  request: z.string().min(1),
};

export const reviewChangeSchema = {
  request: z.string().min(1),
  changeSummary: z.string().optional(),
  changedPaths: z.array(z.string()).optional(),
  scoreBefore: z.number().min(0).max(100).optional(),
};

export const compareArchitectureSchema = {
  request: z.string().min(1),
  changeSummary: z.string().optional(),
  changedPaths: z.array(z.string()).optional(),
  scoreBefore: z.number().min(0).max(100).optional(),
};

export const generateAdrSchema = {
  request: z.string().min(1),
};

export const debugContextSchema = {
  query: z.string().min(1),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
};

export const searchIncidentsSchema = {
  query: z.string().min(1),
};

export const rootCauseSchema = {
  query: z.string().min(1),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
};

export const createIncidentSchema = {
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  affectedModules: z.array(z.string()).optional(),
  links: z
    .array(
      z.object({
        kind: z.enum(['file', 'commit', 'developer', 'decision', 'rule', 'module']),
        ref: z.string(),
      }),
    )
    .optional(),
};

export const incidentHistorySchema = {
  incidentId: z.string().min(1),
};

export const securityContextSchema = {
  query: z.string().min(1),
  filePaths: z.array(z.string()).optional(),
};

export const securityReviewSchema = {
  mode: z.enum(['QUICK', 'DEEP', 'CHANGE']).optional(),
  query: z.string().optional(),
  diff: z.string().optional(),
  changedPaths: z.array(z.string()).optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
  writeReport: z.boolean().optional(),
};

export const threatModelSchema = {
  modules: z.array(z.string()).optional(),
  entryPoints: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional(),
};

export const securityHistorySchema = {
  query: z.string().optional(),
};

export const checkChangeSecuritySchema = {
  diff: z.string().optional(),
  changedPaths: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
};

export const generateDocsSchema = {
  includeModules: z.boolean().optional(),
  includeDecisions: z.boolean().optional(),
  includeOnboarding: z.boolean().optional(),
  persist: z.boolean().optional(),
  readme: z.string().optional(),
};

export const docsHealthSchema = {};

export const explainProjectSchema = {
  focus: z.string().optional(),
};

export const moduleDocsSchema = {
  module: z.string().min(1),
  purpose: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  persist: z.boolean().optional(),
};

export const generateChangelogSchema = {
  commits: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  persist: z.boolean().optional(),
};

export const projectDocumentationSchema = {
  focus: z.string().optional(),
};

export const performanceContextSchema = {
  query: z.string().min(1),
  snippets: z.array(z.string()).optional(),
  filePaths: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
};

export const performanceReviewSchema = {
  query: z.string().optional(),
  snippets: z.array(z.string()).optional(),
  filePaths: z.array(z.string()).optional(),
  modules: z.array(z.string()).optional(),
  dependencyNotes: z.array(z.string()).optional(),
  dependencies: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional(),
  writeReport: z.boolean().optional(),
};

export const scalabilityCheckSchema = {
  modules: z.array(z.string()).optional(),
  dependencies: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional(),
  notes: z.array(z.string()).optional(),
};

export const databaseReviewSchema = {
  snippets: z.array(z.string()).optional(),
  migrations: z.array(z.string()).optional(),
  schemaNotes: z.array(z.string()).optional(),
};

export const performanceHistorySchema = {
  query: z.string().optional(),
};

export const resumeSchema = {
  pendingDecisions: z.array(z.string()).optional(),
  activeArea: z.string().optional(),
};

export const sessionSummarySchema = {
  summary: z.string().optional(),
  close: z.boolean().optional(),
  activeArea: z.string().optional(),
  relatedFiles: z.array(z.string()).optional(),
  unfinishedWork: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  branch: z.string().optional(),
};

export const currentFocusSchema = {
  area: z.string().optional(),
  modules: z.array(z.string()).optional(),
  relatedFiles: z.array(z.string()).optional(),
};

export const handoffSchema = {
  risks: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  persist: z.boolean().optional(),
};

export const taskContextSchema = {
  query: z.string().min(1),
  title: z.string().optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  completed: z.array(z.string()).optional(),
  remaining: z.array(z.string()).optional(),
  relatedDecisions: z.array(z.string()).optional(),
  upsert: z.boolean().optional(),
};

export const graphQuerySchema = {
  projectId: projectIdSchema,
  question: z.string().min(1),
};

export const impactAnalysisSchema = {
  projectId: projectIdSchema,
  target: z.string().min(1),
};

export const relatedKnowledgeSchema = {
  projectId: projectIdSchema,
  query: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
};

export const graphProjectMapSchema = {
  projectId: projectIdSchema,
  persist: z.boolean().optional(),
};

export const reasonSchema = {
  projectId: projectIdSchema,
  request: z.string().min(1),
};

export const recommendSchema = {
  projectId: projectIdSchema,
  request: z.string().min(1),
};

export const decisionContextSchema = {
  projectId: projectIdSchema,
  request: z.string().min(1),
};

export const compareOptionsSchema = {
  projectId: projectIdSchema,
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  topic: z.string().optional(),
  notesA: z.string().optional(),
  notesB: z.string().optional(),
  request: z.string().optional(),
};

export const explainDecisionSchema = {
  projectId: projectIdSchema,
  decisionId: z.string().optional(),
};

export const aiStatusSchema = {
  projectId: projectIdSchema,
};

export const selectModelSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  text: z.string().optional(),
  pathHint: z.string().optional(),
};

export const privacyCheckSchema = {
  projectId: projectIdSchema,
  text: z.string().min(1),
  pathHint: z.string().optional(),
};

export const modelHealthSchema = {
  projectId: projectIdSchema,
};

export const availableModelsSchema = {
  projectId: projectIdSchema,
};

export const bestModelForTaskSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  text: z.string().optional(),
  pathHint: z.string().optional(),
};

export const qualityReportSchema = {
  projectId: projectIdSchema,
};

export const evaluateAnswerSchema = {
  projectId: projectIdSchema,
  task: z.string().min(1),
  answer: z.string().min(1),
  expectedKeywords: z.array(z.string()).optional(),
  unexpectedKeywords: z.array(z.string()).optional(),
  knownFacts: z.array(z.string()).optional(),
  knownFiles: z.array(z.string()).optional(),
  knownDecisions: z.array(z.string()).optional(),
};

export const memoryQualitySchema = {
  projectId: projectIdSchema,
  memories: z
    .array(
      z.object({
        memoryId: z.string(),
        title: z.string(),
        confidence: z.number().optional(),
        usageFrequency: z.number().optional(),
        validationCount: z.number().optional(),
        ageDays: z.number().optional(),
      }),
    )
    .optional(),
};

export const benchmarkRunSchema = {
  projectId: projectIdSchema,
  answersJson: z.string().optional(),
};

export const traceLastSchema = {
  projectId: projectIdSchema,
};

export const explainReasoningSchema = {
  projectId: projectIdSchema,
};

export const traceContextSchema = {
  projectId: projectIdSchema,
};

export const performanceMetricsSchema = {
  projectId: projectIdSchema,
};

export const observabilityDebugSchema = {
  projectId: projectIdSchema,
  enabled: z.boolean().optional(),
  retention: z.enum(['disable', 'temporary', 'persistent']).optional(),
  recordDemo: z.boolean().optional(),
};

const sourceTrustInputSchema = z.object({
  path: z.string().min(1),
  daysSinceChange: z.number().optional(),
  author: z.string().optional(),
  locationKind: z
    .enum(['src', 'docs', 'vendor', 'generated', 'root', 'unknown'])
    .optional(),
  gitUntracked: z.boolean().optional(),
  fromDependency: z.boolean().optional(),
});

export const securityScanCoreSchema = {
  projectId: projectIdSchema,
  texts: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .optional(),
  sources: z.array(sourceTrustInputSchema).optional(),
};

export const checkContextSchema = {
  projectId: projectIdSchema,
  text: z.string().min(1),
  sourceHint: z.string().optional(),
};

export const trustReportSchema = {
  projectId: projectIdSchema,
  sources: z.array(sourceTrustInputSchema).optional(),
};

export const auditLogSchema = {
  projectId: projectIdSchema,
  limit: z.number().int().positive().max(200).optional(),
};

export const neuronSecurityCheckSchema = {
  projectId: projectIdSchema,
  text: z.string().min(1),
  sourceHint: z.string().optional(),
  tool: z.string().optional(),
};

export const workspaceInfoSchema = {
  projectId: projectIdSchema,
};

export const projectSwitchSchema = {
  projectId: projectIdSchema,
  projectName: z.string().optional(),
  memberId: z.string().optional(),
};

export const accessCheckSchema = {
  projectId: projectIdSchema,
  resource: z.enum([
    'memory',
    'documents',
    'decisions',
    'security_reports',
    'workspace_settings',
    'members',
  ]),
  memberId: z.string().optional(),
  workspaceId: z.string().optional(),
};

export const storageStatusSchema = {
  projectId: projectIdSchema,
};

export const architectureScanSchema = {
  projectId: projectIdSchema,
  modulesJson: z.string().optional(),
  dependenciesJson: z.string().optional(),
  label: z.string().optional(),
  testCoverage: z.number().min(0).max(100).optional(),
  documentation: z.number().min(0).max(100).optional(),
  security: z.number().min(0).max(100).optional(),
};

export const dependencyGraphSchema = {
  projectId: projectIdSchema,
  modulesJson: z.string().optional(),
  dependenciesJson: z.string().optional(),
};

export const refactorPlanSchema = {
  projectId: projectIdSchema,
  modulesJson: z.string().optional(),
  dependenciesJson: z.string().optional(),
  label: z.string().optional(),
};

export const architectureScoreSchema = {
  projectId: projectIdSchema,
  modulesJson: z.string().optional(),
  dependenciesJson: z.string().optional(),
  testCoverage: z.number().min(0).max(100).optional(),
  documentation: z.number().min(0).max(100).optional(),
  security: z.number().min(0).max(100).optional(),
};

export const architectureReviewToolSchema = {
  projectId: projectIdSchema,
  modulesJson: z.string().optional(),
  dependenciesJson: z.string().optional(),
  label: z.string().optional(),
  changeSummary: z.string().optional(),
};

const contextNeedSchema = z.enum([
  'files',
  'dependencies',
  'security_rules',
  'git_diff',
  'logs',
  'incidents',
  'architecture',
  'knowledge_graph',
  'decisions',
  'performance_signals',
  'docs',
  'team_memory',
  'technical_debt',
]);

export const availableModesSchema = {
  projectId: projectIdSchema,
};

export const modeContextSchema = {
  projectId: projectIdSchema,
  modeId: z.string().min(1),
  availableContext: z.array(contextNeedSchema).optional(),
};

export const runModeSchema = {
  projectId: projectIdSchema,
  query: z.string().min(1),
  modeId: z.string().optional(),
  availableContext: z.array(contextNeedSchema).optional(),
  useful: z.boolean().optional(),
  feedback: z.string().optional(),
  accuracyHint: z.number().min(0).max(1).optional(),
};

export const gitContextSchema = {
  projectId: projectIdSchema,
  query: z.string().min(1),
  commit: z.string().optional(),
  message: z.string().optional(),
  author: z.string().optional(),
  filesChanged: z.array(z.string()).optional(),
  relatedDecisions: z.array(z.string()).optional(),
  relatedIncidents: z.array(z.string()).optional(),
};

export const changeHistorySchema = {
  projectId: projectIdSchema,
  module: z.string().min(1),
};

export const architectureEvolutionSchema = {
  projectId: projectIdSchema,
  before: z.string().optional(),
  after: z.string().optional(),
  commit: z.string().optional(),
  relatedDecisions: z.array(z.string()).optional(),
};

export const regressionCheckSchema = {
  projectId: projectIdSchema,
  commit: z.string().min(1),
  message: z.string().min(1),
  filesChanged: z.array(z.string()).optional(),
  knownProblemCommits: z
    .array(
      z.object({
        commit: z.string(),
        problem: z.string(),
        files: z.array(z.string()).optional(),
      }),
    )
    .optional(),
};

export const historyContextSchema = {
  projectId: projectIdSchema,
  question: z.string().min(1),
};
