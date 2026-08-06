import type { McpRuntime } from '../config/runtime.js';
import { failResult, okResult } from '../middleware/errors.js';

export async function handleSearch(runtime: McpRuntime, args: { query: string; limit?: number }) {
  try {
    const hits = runtime.neuron.search(args.query, args.limit ?? 10);
    return okResult({
      query: args.query,
      count: hits.length,
      results: hits.map((hit) => ({
        id: hit.doc.id,
        kind: hit.doc.kind,
        title: hit.doc.title,
        content: hit.doc.content,
        why: hit.why,
      })),
    });
  } catch (error) {
    return failResult(error);
  }
}
