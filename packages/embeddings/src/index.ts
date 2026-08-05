export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

/** @deprecated Prefer EmbeddingProvider */
export type Embedder = EmbeddingProvider;

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Deterministic local embedder (no network) — good for tests and hybrid search demos. */
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;

  constructor(dimensions = 64, model = 'hash-local') {
    this.dimensions = dimensions;
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashEmbed(text, this.dimensions));
  }
}

export class MockEmbeddingProvider extends HashEmbeddingProvider {
  constructor() {
    super(32, 'mock-embeddings');
  }
}

/**
 * OpenAI-compatible embeddings client (HTTP).
 * Requires OPENAI_API_KEY (or compatible) at call time.
 */
export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model?: string; dimensions?: number; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'text-embedding-3-small';
    this.dimensions = options.dimensions ?? 1536;
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${await response.text()}`);
    }
    const json = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

export function createEmbedder(kind: 'mock' | 'hash' = 'mock'): EmbeddingProvider {
  return kind === 'hash' ? new HashEmbeddingProvider() : new MockEmbeddingProvider();
}

export interface EmbeddedMemory {
  memoryId: string;
  projectId: string;
  vector: number[];
  model: string;
  contentHash: string;
}

export interface EmbeddingStore {
  upsert(entry: EmbeddedMemory): Promise<void>;
  getByMemoryId(memoryId: string): Promise<EmbeddedMemory | null>;
  listByProject(projectId: string): Promise<EmbeddedMemory[]>;
}

export class InMemoryEmbeddingStore implements EmbeddingStore {
  private readonly items = new Map<string, EmbeddedMemory>();

  async upsert(entry: EmbeddedMemory): Promise<void> {
    this.items.set(entry.memoryId, entry);
  }

  async getByMemoryId(memoryId: string): Promise<EmbeddedMemory | null> {
    return this.items.get(memoryId) ?? null;
  }

  async listByProject(projectId: string): Promise<EmbeddedMemory[]> {
    return [...this.items.values()].filter((e) => e.projectId === projectId);
  }

  exportAll(): EmbeddedMemory[] {
    return [...this.items.values()];
  }

  importAll(entries: EmbeddedMemory[]): void {
    for (const entry of entries) {
      this.items.set(entry.memoryId, entry);
    }
  }
}

export function contentHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function hashEmbed(text: string, dims: number): number[] {
  const vec = new Array<number>(dims).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[i % dims]! += ((code * (i + 1)) % 97) / 97;
  }
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 33 + token.charCodeAt(i)) >>> 0;
    vec[h % dims]! += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
