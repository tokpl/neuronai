/**
 * Documents the Cursor stale-catalog failure mode (P0).
 *
 * This is NOT a Brain/retrieval failure and NOT a mocked Cursor IDE.
 * It encodes the evidence model so we never mis-label root cause.
 *
 * Failure chain:
 *   old Cursor in-memory tools/list (legacy names)
 *        ↓
 *   new 7-tool stdio server (neuron_context, …)
 *        ↓
 *   CallMcpTool(legacy name)
 *        ↓
 *   -32602 Tool not found
 *
 * Distinguishes:
 * - server failure          → fresh stdio tools/list wrong or neuron_context call fails
 * - configuration failure   → .cursor/mcp.json invalid / wrong command
 * - Cursor catalog lifecycle→ stdio PASS + IDE lists legacy / CallMcpTool -32602
 * - Task harness limitation → Task ignores nested fixture .cursor/mcp.json
 */
import { describe, expect, it } from 'vitest';

import {
  EXPECTED_MCP_TOOLS,
  LEGACY_TOOL_MARKERS,
  formatNeuronMcpStatus,
} from '../src/index.js';

describe('stale Cursor MCP catalog failure model', () => {
  it('keeps legacy markers and expected 7 tools disjoint', () => {
    const overlap = EXPECTED_MCP_TOOLS.filter((t) =>
      (LEGACY_TOOL_MARKERS as readonly string[]).includes(t),
    );
    expect(overlap).toEqual([]);
    expect(EXPECTED_MCP_TOOLS).toHaveLength(7);
    expect(EXPECTED_MCP_TOOLS).toContain('neuron_context');
    expect(LEGACY_TOOL_MARKERS).toContain('neuron_prepare_task');
    expect(LEGACY_TOOL_MARKERS).toContain('neuron_get_context');
  });

  it('classifies -32602 on legacy names with stdio PASS as catalog lifecycle, not Brain', () => {
    const stdioPass = {
      configured: 'PASS' as const,
      freshStdio: 'PASS' as const,
      toolCount: 7,
      neuronContext: 'PASS' as const,
    };
    const ideSeesLegacy = ['neuron_prepare_task', 'neuron_get_context'];
    const callError = 'MCP error -32602: Tool neuron_prepare_task not found';

    const rootCause =
      stdioPass.freshStdio === 'PASS' &&
      stdioPass.neuronContext === 'PASS' &&
      ideSeesLegacy.some((t) => (LEGACY_TOOL_MARKERS as readonly string[]).includes(t)) &&
      /-32602/.test(callError)
        ? 'cursor_catalog_lifecycle'
        : 'other';

    expect(rootCause).toBe('cursor_catalog_lifecycle');
    expect(rootCause).not.toBe('brain_retrieval');
  });

  it('formatNeuronMcpStatus never invents IDE PASS without evidence', () => {
    const block = formatNeuronMcpStatus({
      configured: 'PASS',
      configuredDetail: 'ok',
      freshStdio: 'PASS',
      freshStdioDetail: 'ok',
      toolCount: 7,
      tools: [...EXPECTED_MCP_TOOLS],
      neuronContext: 'PASS',
      neuronContextDetail: 'ok',
      ideCatalog: 'MANUAL_CHECK_REQUIRED',
      ideCatalogDetail: 'manual',
      action: 'RELOAD_REQUIRED',
      actionDetail: 'reload',
    });
    expect(block).toMatch(/IDE catalog: MANUAL CHECK REQUIRED/);
    expect(block).toMatch(/Action: RELOAD REQUIRED/);
    expect(block).not.toMatch(/IDE catalog: PASS/);
  });
});
