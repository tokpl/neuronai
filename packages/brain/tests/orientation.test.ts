import { describe, expect, it } from 'vitest';

import {
  buildOrientationMap,
  formatOrientationMarkdown,
  shouldEmitOrientation,
} from '../src/orientation.js';

describe('orientation map', () => {
  it('emits for deep mode and GENERAL_PROJECT', () => {
    expect(
      shouldEmitOrientation({
        mode: 'deep',
        intent: 'MODIFICATION',
        task: 'change billing',
      }),
    ).toBe(true);
    expect(
      shouldEmitOrientation({
        mode: 'minimal',
        intent: 'GENERAL_PROJECT',
        task: 'overview',
      }),
    ).toBe(true);
    expect(
      shouldEmitOrientation({
        mode: 'minimal',
        intent: 'MODIFICATION',
        task: 'how does the MCP server work?',
      }),
    ).toBe(true);
  });

  it('builds oneLiner / fiveMinute / deepDive from Brain paths', () => {
    const map = buildOrientationMap({
      task: 'how does workflow playbooks work?',
      intent: 'GENERAL_PROJECT',
      projectName: 'neuron',
      recommendation: {
        path: 'packages/brain/src/workflow/playbooks.ts',
        name: 'playbooks',
        kind: 'file',
        reason: 'checklist evidence lives here',
        related: [],
        flow: [
          { label: 'playbookChecklist', path: 'packages/brain/src/workflow/playbooks.ts' },
          { label: 'complete_checklist', path: 'apps/mcp-server/src/handlers/workflow.ts' },
        ],
      },
      relevantFiles: [
        {
          name: 'playbooks',
          path: 'packages/brain/src/workflow/playbooks.ts',
          kind: 'file',
          why: 'match',
        },
      ],
      relevantModules: [],
    });
    expect(map.oneLiner).toMatch(/playbooks\.ts/);
    expect(map.fiveMinute.keyFiles[0]).toBe('packages/brain/src/workflow/playbooks.ts');
    expect(map.deepDive.flow.length).toBeGreaterThan(0);
    expect(formatOrientationMarkdown(map)).toMatch(/## Orientation Map/);
  });
});
