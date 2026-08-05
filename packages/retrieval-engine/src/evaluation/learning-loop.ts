import type { RankingWeights } from '../types.js';
import { DEFAULT_RANKING_WEIGHTS } from '../types.js';

export interface RetrievalFeedback {
  task: string;
  usedHitIds: string[];
  rejectedHitIds?: string[];
  helpful?: boolean;
}

/**
 * Lightweight learning loop: nudge ranking weights from agent/user feedback.
 * Does not train neural models.
 */
export class RetrievalLearningLoop {
  private weights: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS };

  getWeights(): RankingWeights {
    return { ...this.weights };
  }

  record(feedback: RetrievalFeedback): RankingWeights {
    if (feedback.helpful === false || (feedback.rejectedHitIds?.length ?? 0) > 0) {
      this.weights = {
        ...this.weights,
        relevance: this.weights.relevance + 0.01,
        taskRelevance: this.weights.taskRelevance + 0.02,
        freshness: this.weights.freshness + 0.01,
        importance: Math.max(0.05, this.weights.importance - 0.01),
      };
    }
    if (feedback.helpful === true && feedback.usedHitIds.length > 0) {
      this.weights = {
        ...this.weights,
        taskRelevance: this.weights.taskRelevance + 0.01,
        confidence: this.weights.confidence + 0.005,
      };
    }
    this.weights = normalize(this.weights);
    return this.getWeights();
  }
}

function normalize(w: RankingWeights): RankingWeights {
  const sum =
    w.relevance + w.importance + w.confidence + w.distance + w.freshness + w.taskRelevance;
  return {
    relevance: w.relevance / sum,
    importance: w.importance / sum,
    confidence: w.confidence / sum,
    distance: w.distance / sum,
    freshness: w.freshness / sum,
    taskRelevance: w.taskRelevance / sum,
  };
}

export function createRetrievalLearningLoop(): RetrievalLearningLoop {
  return new RetrievalLearningLoop();
}
