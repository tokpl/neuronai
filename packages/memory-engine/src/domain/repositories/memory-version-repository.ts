import type { MemoryVersion } from '../entities/memory-version.js';

export interface MemoryVersionRepository {
  save(version: MemoryVersion): Promise<void>;
  listByMemoryId(memoryId: string): Promise<MemoryVersion[]>;
}
