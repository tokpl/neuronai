import type { MemoryRelation } from '../entities/memory-relation.js';

export interface MemoryRelationRepository {
  save(relation: MemoryRelation): Promise<void>;
  listByMemoryId(memoryId: string): Promise<MemoryRelation[]>;
  listByProjectId(projectId: string): Promise<MemoryRelation[]>;
}
