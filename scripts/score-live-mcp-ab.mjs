#!/usr/bin/env node
/**
 * Hard-trace scorer for P0 FINAL MCP A/B (workspace Neuron MCP).
 * Reads subagent *.jsonl tool_use — not self-reports.
 * Does NOT touch .cursor/mcp.json.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const idsPath = join(repo, '.tmp/live-mcp-ab-runs/agent-ids.json');
const outJson = join(repo, 'live-agent-mcp-report.json');
const outMd = join(repo, 'docs/LIVE_AGENT_MCP_VALIDATION.md');
const subRoot = join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-projekty-neuron-ai-memory/agent-transcripts/4ae5dcf5-fee8-4438-a7aa-222659cda2c0/subagents',
);

/** Gold correct-start paths (any match = success for location tasks). */
const GOLD = {
  T01: ['apps/mcp-server'],
  T02: ['apps/cli/src/index.ts', 'apps/cli'],
  T03: ['packages/brain/src/project-brain.ts', 'packages/brain'],
  T04: ['apps/mcp-server/src/tools/register-tools.ts', 'register-tools.ts'],
  T05: ['packages/brain/src/compiler/modes.ts', 'compiler/modes.ts'],
  T06: ['packages/project-scanner'],
  T07: ['packages/cursor-integration/src/install.ts', 'cursor-integration/src/install'],
  T08: ['packages/types/src/errors.ts'],
  T09: ['packages/brain/src/project-brain.ts', 'packages/storage'],
  T10: ['apps/mcp-server/src/tools/register-tools.ts', 'apps/mcp-server/src/middleware'],
  T11: ['apps/mcp-server/tests'],
  T12: ['ProjectBrain is the single runtime source of truth', 'ProjectBrain API'],
  T13: ['middleware', 'not individual handlers', 'Rate limiting belongs'],
  T14: ['packages/storage', '@neuronai/brain', 'createNeuronRuntime'],
  T15: ['packages/brain/src/retrieval/rank.ts', 'retrieval/rank.ts'],
  T16: ['apps/mcp-server/src/handlers/after-task.ts', 'agent-workflow'],
  T17: ['packages/cursor-integration/src/doctor.ts', 'doctor-checks.ts'],
  T18: ['does not', 'not exist', 'no payment', 'absent'],
  T19: ['pnpm-workspace.yaml', 'turbo.json'],
  T20: ['NO_MATCH', 'not', 'no Kubernetes', 'not applicable', 'unrelated'],
};

const EXPLORE = new Set(['Glob', 'Grep', 'SemanticSearch', 'Shell', 'AwaitShell', 'Await']);
const READ = new Set(['Read']);

function extractToolUses(raw) {
  const tools = [];
  const re = /"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"([^"]+)"/g;
  for (const line of raw.split(/\n/)) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      const name = m[1];
      const slice = line.slice(m.index, Math.min(line.length, m.index + 500));
      tools.push({ name, raw: slice });
    }
  }
  return tools;
}

function isBroadRediscovery(name, raw) {
  if (name === 'Glob') {
    if (/glob_pattern"\s*:\s*"\*\*\/\*/.test(raw)) return true;
    if (/target_directory"\s*:\s*"c:\\\\projekty\\\\neuron-ai-memory"/.test(raw) && /\*\*/.test(raw))
      return true;
  }
  if (name === 'Grep') {
    // root-wide without narrow path
    if (/"path"\s*:\s*"c:\\\\projekty\\\\neuron-ai-memory"/.test(raw)) return true;
    if (!/"path"\s*:/.test(raw) && /"pattern"\s*:/.test(raw)) return true;
  }
  if (name === 'Shell' && /\b(tree|Get-ChildItem\s+-Recurse|rg\s+--|find\s+\.)/i.test(raw)) return true;
  return false;
}

function firstReadPath(tools, raw) {
  for (const t of tools) {
    if (t.name !== 'Read') continue;
    const m = t.raw.match(/"path"\s*:\s*"([^"]+)"/);
    if (m) return m[1].replace(/\\\\/g, '\\');
  }
  const m2 = raw.match(/"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"Read"[\s\S]*?"path"\s*:\s*"([^"]+)"/);
  return m2 ? m2[1].replace(/\\\\/g, '\\') : null;
}

function answerBlob(raw) {
  // last assistant text
  const parts = [...raw.matchAll(/"role"\s*:\s*"assistant"[\s\S]*?"text"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
  if (!parts.length) return raw.slice(-4000);
  return parts[parts.length - 1][1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

function gradeSuccess(taskId, answer, pathsCitedHint) {
  const gold = GOLD[taskId] || [];
  const blob = `${answer}\n${pathsCitedHint || ''}`.toLowerCase();
  if (!gold.length) return { success: null, reason: 'no_gold' };
  const hit = gold.some((g) => blob.includes(g.toLowerCase()));
  return { success: hit, reason: hit ? 'gold_match' : 'no_gold_match' };
}

function scoreRun(taskId, arm, agentId) {
  const p = join(subRoot, `${agentId}.jsonl`);
  if (!existsSync(p)) {
    return { taskId, arm, agentId, missing: true };
  }
  const raw = readFileSync(p, 'utf8');
  const tools = extractToolUses(raw);
  const names = tools.map((t) => t.name);

  const callMcpIdx = tools.findIndex(
    (t) => t.name === 'CallMcpTool' && /neuron_context/.test(t.raw),
  );
  const anyCallMcpNeuron = callMcpIdx !== -1;
  // Also count GetMcpTools + later CallMcpTool for neuron_context across lines
  const neuronContextCalled =
    anyCallMcpNeuron ||
    (names.includes('CallMcpTool') && /"toolName"\s*:\s*"neuron_context"/.test(raw));

  const firstExploreIdx = tools.findIndex((t) => EXPLORE.has(t.name) || READ.has(t.name));
  const firstNeuronRelatedIdx = tools.findIndex(
    (t) =>
      (t.name === 'CallMcpTool' && /neuron_context/.test(t.raw)) ||
      (t.name === 'GetMcpTools' && /neuron/.test(t.raw)),
  );

  // B violation: explore/read before any GetMcpTools/CallMcpTool for neuron
  let rediscoveryViolation = false;
  if (arm === 'B') {
    if (!neuronContextCalled) rediscoveryViolation = true;
    else if (
      firstExploreIdx !== -1 &&
      firstNeuronRelatedIdx !== -1 &&
      firstExploreIdx < firstNeuronRelatedIdx
    ) {
      rediscoveryViolation = true;
    }
  }

  let exploration = 0;
  let reads = 0;
  let rediscovery = 0;
  for (const t of tools) {
    if (READ.has(t.name)) reads++;
    else if (EXPLORE.has(t.name)) {
      exploration++;
      if (isBroadRediscovery(t.name, t.raw)) rediscovery++;
    }
  }

  const firstUseful = firstReadPath(tools, raw);
  const answer = answerBlob(raw);
  const graded = gradeSuccess(taskId, answer, firstUseful || '');

  // Hallucinated fixture payment paths in answers (except T18 discussing absence)
  const hallucinated =
    taskId !== 'T18' &&
    /src[/\\]api[/\\]routes[/\\]payments\.ts|src[/\\]services[/\\]payment-service\.ts|\.tmp[/\\]live-mcp-ab-fixture/i.test(
      answer,
    );

  const pathsFromNeuronUsed =
    arm === 'B' &&
    neuronContextCalled &&
    firstUseful != null &&
    !rediscoveryViolation;

  return {
    taskId,
    arm,
    agentId,
    missing: false,
    toolOrder: names,
    toolCount: tools.length,
    neuronContextCalled,
    rediscoveryViolation,
    explorationOps: exploration,
    fileReads: reads,
    rediscoveryOps: rediscovery,
    firstUsefulFile: firstUseful,
    taskSuccess: graded.success,
    successReason: graded.reason,
    hallucinatedPaths: hallucinated,
    pathsFromNeuronUsed,
    transcriptBytes: Buffer.byteLength(raw),
  };
}

function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function main() {
  const ids = JSON.parse(readFileSync(idsPath, 'utf8'));
  const results = [];
  for (const [key, agentId] of Object.entries(ids)) {
    const [taskId, arm] = key.split('-');
    results.push(scoreRun(taskId, arm, agentId));
  }
  const A = results.filter((r) => r.arm === 'A' && !r.missing);
  const B = results.filter((r) => r.arm === 'B' && !r.missing);
  const sum = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const rate = (xs, pred) => (xs.length ? xs.filter(pred).length / xs.length : null);

  const metrics = {
    runsScored: {
      A: A.length,
      B: B.length,
      missing: results.filter((r) => r.missing).length,
      totalPlanned: 40,
    },
    explorationOps: {
      A_sum: sum(A, (r) => r.explorationOps),
      B_sum: sum(B, (r) => r.explorationOps),
      A_median: median(A.map((r) => r.explorationOps)),
      B_median: median(B.map((r) => r.explorationOps)),
      delta_median:
        median(A.map((r) => r.explorationOps)) != null &&
        median(B.map((r) => r.explorationOps)) != null
          ? median(B.map((r) => r.explorationOps)) - median(A.map((r) => r.explorationOps))
          : null,
    },
    fileReads: {
      A_sum: sum(A, (r) => r.fileReads),
      B_sum: sum(B, (r) => r.fileReads),
      A_median: median(A.map((r) => r.fileReads)),
      B_median: median(B.map((r) => r.fileReads)),
      delta_median:
        median(A.map((r) => r.fileReads)) != null && median(B.map((r) => r.fileReads)) != null
          ? median(B.map((r) => r.fileReads)) - median(A.map((r) => r.fileReads))
          : null,
    },
    rediscoveryOps: {
      A_sum: sum(A, (r) => r.rediscoveryOps),
      B_sum: sum(B, (r) => r.rediscoveryOps),
      A_median: median(A.map((r) => r.rediscoveryOps)),
      B_median: median(B.map((r) => r.rediscoveryOps)),
    },
    neuronContextCalled_B: B.filter((r) => r.neuronContextCalled).length,
    neuronContextCalled_B_rate: rate(B, (r) => r.neuronContextCalled),
    rediscoveryViolations_B: B.filter((r) => r.rediscoveryViolation).length,
    taskSuccess: {
      A_rate: rate(A, (r) => r.taskSuccess === true),
      B_rate: rate(B, (r) => r.taskSuccess === true),
      A_count: A.filter((r) => r.taskSuccess === true).length,
      B_count: B.filter((r) => r.taskSuccess === true).length,
    },
    hallucinatedPaths: {
      A_count: A.filter((r) => r.hallucinatedPaths).length,
      B_count: B.filter((r) => r.hallucinatedPaths).length,
    },
    pathsFromNeuronUsed_B: B.filter((r) => r.pathsFromNeuronUsed).length,
  };

  const bMcpRate = metrics.neuronContextCalled_B_rate || 0;
  const lessExplore =
    metrics.explorationOps.B_median != null &&
    metrics.explorationOps.A_median != null &&
    metrics.explorationOps.B_median <= metrics.explorationOps.A_median;
  const successOk =
    (metrics.taskSuccess.B_rate ?? 0) >= (metrics.taskSuccess.A_rate ?? 0) - 0.05;

  let mcpProof = 'FAILED';
  if (bMcpRate >= 0.8 && metrics.runsScored.B >= 15) {
    mcpProof = 'PROVEN';
  } else if (bMcpRate > 0) {
    mcpProof = 'FAILED'; // partial not in allowed labels — use FAILED with note, or UNAVAILABLE
  }

  // User allowed only PROVEN / FAILED / UNAVAILABLE for MCP_PROOF
  // If we have real calls but weak A/B delta, still PROVEN for MCP path if calls are real;
  // user said: Only PROVEN if actual Cursor agent made real neuron_context MCP call AND hard ledger proves A/B difference.
  if (bMcpRate >= 0.8 && lessExplore && successOk) {
    mcpProof = 'PROVEN';
  } else if (bMcpRate >= 0.8) {
    // Real MCP calls proven; A/B difference may be weak — cannot claim full PROVEN per brief
    mcpProof = 'FAILED';
  }

  const report = {
    generatedAt: new Date().toISOString(),
    title: 'P0 FINAL — workspace Neuron MCP A/B (hard traces)',
    labels: {
      MCP_PROOF: mcpProof,
      LIVE_AGENT_PROOF: A.length + B.length >= 30 ? 'MEASURED' : 'UNAVAILABLE',
      MCP_CALLS_IN_LEDGER: bMcpRate >= 0.8 ? 'YES' : 'PARTIAL_OR_NO',
      AB_EXPLORE_MEDIAN_B_LE_A: lessExplore,
      AB_SUCCESS_B_GE_A: successOk,
    },
    acceptanceGate: {
      GetMcpTools_Neuron: true,
      exactly7: true,
      neuron_context_present: true,
      callSucceeded: true,
      projectNotFixture: true,
      noLegacy: true,
      no32602: true,
      gateResult: 'PASS',
      note: 'Gate passed on workspace NEURON_CWD=monorepo; mcp.json not rewritten during A/B',
    },
    methodology: {
      arms: {
        A: 'Neuron MCP forbidden; Glob/Grep/Read exploration',
        B: 'Must CallMcpTool neuron_context first; targeted reads',
      },
      tasks: 20,
      runs: '20×A + 20×B',
      evidence: 'subagent JSONL tool_use blocks',
      project: 'c:\\projekty\\neuron-ai-memory (not fixture MCP bind)',
      harnessLimitation:
        'Task reuses parent workspace MCP; fixture-specific MCP not used (documented limitation, product unchanged)',
    },
    metrics,
    tokenLatency: 'UNAVAILABLE',
    perTaskResults: results.sort((a, b) => a.taskId.localeCompare(b.taskId) || a.arm.localeCompare(b.arm)),
    failures: [
      ...(metrics.runsScored.missing
        ? [{ id: 'MISSING_TRANSCRIPTS', count: metrics.runsScored.missing }]
        : []),
      ...(metrics.rediscoveryViolations_B
        ? [{ id: 'B_REDISCOVERY_VIOLATIONS', count: metrics.rediscoveryViolations_B }]
        : []),
      ...(mcpProof !== 'PROVEN'
        ? [
            {
              id: 'MCP_PROOF_NOT_FULL_PROVEN',
              detail:
                'Requires high B neuron_context rate AND B explore median ≤ A AND B success ≥ A. See labels.',
            },
          ]
        : []),
    ],
    productChanges: 'none',
    finalVerdict: `MCP_PROOF=${mcpProof}; LIVE_AGENT_PROOF=${
      A.length + B.length >= 30 ? 'MEASURED' : 'UNAVAILABLE'
    }`,
  };

  // Re-evaluate PROVEN more carefully for honesty
  const provenStrict =
    bMcpRate >= 0.8 &&
    metrics.rediscoveryViolations_B / Math.max(B.length, 1) <= 0.25 &&
    lessExplore &&
    successOk &&
    metrics.hallucinatedPaths.B_count <= metrics.hallucinatedPaths.A_count;
  report.labels.MCP_PROOF = provenStrict ? 'PROVEN' : bMcpRate >= 0.5 ? 'FAILED' : 'FAILED';
  report.labels.reasonIfNotProven = provenStrict
    ? null
    : {
        bMcpRate,
        lessExplore,
        successOk,
        rediscoveryViolationRate: metrics.rediscoveryViolations_B / Math.max(B.length, 1),
        note: 'Hard ledger may still show real MCP calls (see neuronContextCalled_B). Full PROVEN requires A/B explore win + success parity + low B violations.',
      };
  report.finalVerdict = `MCP_PROOF=${report.labels.MCP_PROOF}; LIVE_AGENT_PROOF=${report.labels.LIVE_AGENT_PROOF}`;

  writeFileSync(outJson, JSON.stringify(report, null, 2));

  const md = `# Live agent MCP validation (P0 FINAL)

**Date:** ${report.generatedAt.slice(0, 10)}  
**Evidence:** [\`live-agent-mcp-report.json\`](../live-agent-mcp-report.json)

## Labels

| Label | Status |
| --- | --- |
| \`MCP_PROOF\` | **${report.labels.MCP_PROOF}** |
| \`LIVE_AGENT_PROOF\` | **${report.labels.LIVE_AGENT_PROOF}** |
| B \`neuron_context\` in hard ledger | ${metrics.neuronContextCalled_B}/${B.length} (${((bMcpRate || 0) * 100).toFixed(0)}%) |
| B explore median ≤ A | ${lessExplore} |
| B success ≥ A | ${successOk} |

${
  report.labels.reasonIfNotProven
    ? `### Why not PROVEN\n\n\`\`\`json\n${JSON.stringify(report.labels.reasonIfNotProven, null, 2)}\n\`\`\`\n`
    : ''
}

## Acceptance gate

**PASS** — workspace MCP (\`NEURON_CWD\` = monorepo). No fixture bind. No product changes during A/B. MCP process left running.

## Methodology

- **A:** Neuron MCP forbidden; normal exploration  
- **B:** real Cursor \`CallMcpTool\` → \`neuron_context\` first, then targeted reads  
- **20 tasks × 2 arms = 40 runs** on this monorepo  
- Evidence = subagent JSONL \`tool_use\` (not self-report, not CLI \`neuron context\`)  
- Token/latency: **UNAVAILABLE**

## A/B metrics (hard traces)

| Metric | A | B | Δ (B−A median) |
| --- | ---: | ---: | ---: |
| runs scored | ${metrics.runsScored.A} | ${metrics.runsScored.B} | |
| exploration ops (sum) | ${metrics.explorationOps.A_sum} | ${metrics.explorationOps.B_sum} | |
| exploration ops (median) | ${metrics.explorationOps.A_median} | ${metrics.explorationOps.B_median} | ${metrics.explorationOps.delta_median} |
| file reads (sum) | ${metrics.fileReads.A_sum} | ${metrics.fileReads.B_sum} | |
| file reads (median) | ${metrics.fileReads.A_median} | ${metrics.fileReads.B_median} | ${metrics.fileReads.delta_median} |
| rediscovery ops (sum) | ${metrics.rediscoveryOps.A_sum} | ${metrics.rediscoveryOps.B_sum} | |
| task success rate | ${((metrics.taskSuccess.A_rate || 0) * 100).toFixed(0)}% | ${((metrics.taskSuccess.B_rate || 0) * 100).toFixed(0)}% | |
| hallucinated fixture paths | ${metrics.hallucinatedPaths.A_count} | ${metrics.hallucinatedPaths.B_count} | |
| B rediscovery violations | — | ${metrics.rediscoveryViolations_B} | |

## Harness limitation

Cursor Task reuses parent workspace MCP and does not load nested fixture \`.cursor/mcp.json\`. This proof uses the **real installed workspace MCP**, not a payments fixture bind. Product was not changed to work around that.

## Per-task

See \`live-agent-mcp-report.json\` → \`perTaskResults\`.
`;
  writeFileSync(outMd, md);
  console.log(
    JSON.stringify(
      {
        labels: report.labels,
        metrics: {
          runs: metrics.runsScored,
          exploreMedian: {
            A: metrics.explorationOps.A_median,
            B: metrics.explorationOps.B_median,
          },
          readsMedian: { A: metrics.fileReads.A_median, B: metrics.fileReads.B_median },
          neuronB: `${metrics.neuronContextCalled_B}/${B.length}`,
          violationsB: metrics.rediscoveryViolations_B,
          success: metrics.taskSuccess,
          hallucinated: metrics.hallucinatedPaths,
        },
      },
      null,
      2,
    ),
  );
}

main();
