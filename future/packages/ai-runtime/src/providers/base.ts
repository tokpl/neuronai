import { createHash } from 'node:crypto';

import type {
  AnalyzeResult,
  EmbedResult,
  GenerateOptions,
  GenerateResult,
  ProviderHealth,
  ProviderKind,
  ReasonResult,
  RuntimeAIProvider,
} from '../types.js';

export function hashEmbed(text: string, dims = 32): number[] {
  const digest = createHash('sha256').update(text).digest();
  const out = new Array<number>(dims);
  for (let i = 0; i < dims; i++) {
    out[i] = ((digest[i % digest.length] ?? 0) / 255) * 2 - 1;
  }
  return out;
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export abstract class BaseRuntimeProvider implements RuntimeAIProvider {
  abstract readonly id: string;
  abstract readonly kind: ProviderKind;
  abstract readonly name: string;
  abstract readonly local: boolean;
  abstract readonly supportsGenerate: boolean;
  abstract readonly supportsEmbed: boolean;

  abstract generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
  abstract health(): Promise<ProviderHealth>;

  async embed(texts: string[]): Promise<EmbedResult> {
    return {
      vectors: texts.map((t) => hashEmbed(t)),
      model: 'hash-fallback',
      provider: this.id,
      contentHashes: texts.map(contentHash),
      dimensions: 32,
    };
  }

  async analyze(text: string, context?: string): Promise<AnalyzeResult> {
    const gen = await this.summarize(`${context ? `${context}\n` : ''}${text}`);
    return {
      summary: gen.text,
      labels: [],
      model: gen.model,
      provider: this.id,
    };
  }

  async summarize(text: string): Promise<GenerateResult> {
    return this.generate(`Summarize:\n${text.slice(0, 8000)}`, { maxTokens: 512 });
  }

  async reason(prompt: string, context?: string): Promise<ReasonResult> {
    const gen = await this.generate(
      `Reason carefully.\nContext:\n${context ?? '(none)'}\n\nQuestion:\n${prompt}`,
      { maxTokens: 1024 },
    );
    return {
      conclusion: gen.text.slice(0, 400),
      reasoning: gen.text,
      confidence: 0.55,
      model: gen.model,
      provider: this.id,
    };
  }
}

/** Shared OpenAI-compatible chat/embeddings HTTP helpers (architecture — real calls when reachable). */
export async function openAiCompatibleChat(opts: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  prompt: string;
  system?: string;
  timeoutMs?: number;
}): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();
  const url = `${opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: opts.prompt },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? '';
  return { text, latencyMs: Date.now() - started };
}

export async function openAiCompatibleEmbed(opts: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  texts: string[];
  timeoutMs?: number;
}): Promise<{ vectors: number[][]; latencyMs: number }> {
  const started = Date.now();
  const url = `${opts.baseUrl.replace(/\/$/, '')}/embeddings`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: opts.model, input: opts.texts }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const vectors = (json.data ?? []).map((d) => d.embedding);
  return { vectors, latencyMs: Date.now() - started };
}

export function resolveApiKey(envName?: string): string | undefined {
  if (!envName) return undefined;
  const v = process.env[envName];
  return v && v.length > 0 ? v : undefined;
}
