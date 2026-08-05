export type {
  NeuronDecisionType,
  FeedbackLabel,
  EvidenceItem,
  NeuronDecision,
  DecisionTrace,
  DecisionFeedback,
  ReasoningContext,
  OptionPair,
  DecisionStoreDocument,
} from './types.js';
export { nowIso, newId } from './types.js';

export { EvidenceGatherer, createEvidenceGatherer } from './reasoning/evidence.js';
export { ConflictDetector, createConflictDetector } from './reasoning/conflicts.js';
export { ReasoningEngine, createReasoningEngine } from './reasoning/engine.js';
export {
  ConfidenceCalculator,
  createConfidenceCalculator,
} from './confidence/calculator.js';
export { DecisionExplainer, createDecisionExplainer } from './explanations/explainer.js';
export {
  AlternativeAnalyzer,
  createAlternativeAnalyzer,
} from './recommendations/alternatives.js';
export { DECISION_POLICIES, listDecisionPolicies } from './policies/rules.js';
export { DecisionEvaluator, createDecisionEvaluator } from './evaluation/evaluator.js';
export { FeedbackStore, createFeedbackStore } from './evaluation/feedback.js';
export {
  DecisionEngine,
  createDecisionEngine,
} from './facade/decision-engine.js';
