#!/usr/bin/env node
/**
 * Hard-trace scorer for Cursor Task subagent transcripts.
 * Reads tool_use blocks from *.jsonl — not agent self-reports.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

const WAVE1 = {
  'T01-A': '488a1f3e-7c2f-4ba3-bacd-9974c1bbbdc0',
  'T01-B': '483a91f7-7276-4d2b-8ad8-d7d0f8172d5b',
  'T02-A': '7289dd84-c7bd-44c0-ad9c-ed042c5f1ce7',
  'T02-B': 'bcddb4a5-5349-45b8-84c9-dd6cc938e43a',
  'T03-A': 'eab9c601-26ce-4063-8b89-8ad281b94e86',
  'T03-B': '1f9d9ec6-6808-4234-bb66-94b8c0f29fd5',
  'T05-A': '12bdd7d9-3a33-488a-97e2-33df7edf1e86',
  'T05-B': '41e325a0-4a53-4dfc-a6bd-5d1516314694',
  'T10-A': '1cb901d4-3fba-44f4-b703-3d17c83da709',
  'T10-B': 'ea8cd949-2768-4caf-8916-b952f8a5a2a6',
  'T11-A': '1d05c312-071b-4c56-a2d2-e3e9fa097fc4',
  'T11-B': '84f49149-a78b-459f-8a09-2ac6914c0b92',
  'T12-A': '37ce6c16-e0a3-481a-841e-8f18d7d422ab',
  'T12-B': 'ade1a01d-6ac8-4fce-93b6-4095b52af181',
  'T13-A': '93ccb157-78f6-4337-9f6d-d2d44d3094a9',
  'T13-B': 'd2878c48-703f-4f11-8124-27057eccd799',
};

const GOLD = {
  T01: ['src/api/routes/payments.ts', 'src/billing/invoice-service.ts', 'src/services/payment-service.ts'],
  T02: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'],
  T03: ['src/auth/service.ts', 'src/middleware/auth.ts', 'tests/auth/auth.test.ts'],
  T05: ['src/workers/jobs.ts', 'src/services/payment-service.ts', 'src/workers/payment-retry-worker.ts'],
  T10: ['src/api/routes/webhooks.ts', 'src/workers/jobs.ts', 'src/services/payment-service.ts'],
  T11: ['src/api/routes/payments.ts', 'src/services/payment-service.ts'],
  T12: ['src/services/payment-service.ts', 'src/services/stripe.ts', 'src/db/payment-repository.ts'],
  T13: [],
};

function findTranscript(agentId) {
  const roots = [
    join(
      process.env.USERPROFILE || '',
      '.cursor/projects/c-projekty-neuron-ai-memory/agent-transcripts',
    ),
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const p = join(root, dir.name, 'subagents', `${agentId}.jsonl`);
      if (existsSync(p)) return p;
      const p2 = join(root, dir.name, `${agentId}.jsonl`);
      if (existsSync(p2)) return p2;
    }
  }
  return null;
}

function extractToolUses(raw) {
  const events = [];
  // tool_use may appear as JSON objects inside lines
  const re =
    /"type"\s*:\s*"tool_use"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"input"\s*:\s*(\{[\s\S]*?\})(?=\s*\},?\s*\{|\s*\}\s*\])/g;
  // Simpler line-based parse: each assistant message may contain multiple tool_use
  for (const line of raw.split(/\n/)) {
    if (!line.includes('"tool_use"')) continue;
    let idx = 0;
    while (true) {
      const i = line.indexOf('"type":"tool_use"', idx);
      const j = line.indexOf('"type": "tool_use"', idx);
      const start = i === -1 ? j : j === -1 ? i : Math.min(i, j);
      if (start === -1) break;
      // find name
      const nameMatch = line.slice(start).match(/"name"\s*:\s*"([^"]+)"/);
      if (!nameMatch) {
        idx = start + 10;
        continue;
      }
      const name = nameMatch[1];
      const afterName = start + nameMatch.index + nameMatch[0].length;
      const inputMatch = line.slice(afterName).match(/"input"\s*:\s*/);
      let input = {};
      if (inputMatch) {
        const inputStart = afterName + inputMatch.index + inputMatch[0].length;
        try {
          // brace match
          if (line[inputStart] === '{') {
            let depth = 0;
            let end = inputStart;
            for (; end < line.length; end++) {
              if (line[end] === '{') depth++;
              else if (line[end] === '}') {
                depth--;
                if (depth === 0) {
                  end++;
                  break;
                }
              }
            }
            input = JSON.parse(line.slice(inputStart, end));
          }
        } catch {
          input = {};
        }
      }
      events.push({ name, input });
      idx = start + 20;
    }
  }
  return events;
}

function pathFromInput(input) {
  if (!input || typeof input !== 'object') return null;
  for (const k of ['path', 'file_path', 'target_file', 'filePath', 'filename']) {
    if (typeof input[k] === 'string' && input[k]) return input[k].replace(/\\/g, '/');
  }
  return null;
}

function classify(name) {
  const n = name.toLowerCase();
  if (n.includes('neuron')) return 'neuron_mcp';
  if (n === 'read' || n === 'readfile') return 'read';
  if (n === 'grep' || n === 'rg') return 'grep';
  if (n === 'glob' || n === 'list_dir' || n === 'ls') return 'list_dir';
  if (n === 'shell' || n === 'bash' || n === 'run_terminal_cmd') return 'shell';
  if (n === 'strreplace' || n === 'write' || n === 'applypatch' || n === 'editnotebook')
    return 'edit';
  if (n === 'updatecurrentstep' || n === 'todowrite') return 'meta';
  return 'other';
}

function isUseful(path, gold) {
  if (!path || !gold?.length) return false;
  const p = path.replace(/\\/g, '/');
  return gold.some((g) => p.endsWith(g) || p.includes(g));
}

function isNoise(path) {
  if (!path) return false;
  return /noise|legacy|old-billing|misc-utils|payments\/README|billing-payments|payments-service\.ts/i.test(
    path,
  );
}

function scoreRun(key, agentId) {
  const [taskId, arm] = key.split('-');
  const transcript = findTranscript(agentId);
  if (!transcript) {
    return { key, agentId, error: 'transcript_missing', TRACE_QUALITY: 'MISSING' };
  }
  const raw = readFileSync(transcript, 'utf8');
  const tools = extractToolUses(raw);
  const gold = GOLD[taskId] || [];

  const ledger = [];
  let firstUseful = null;
  let readsBeforeUseful = 0;
  let wrongFiles = 0;
  let neuronCliShell = false;
  let neuronMcp = false;

  for (const t of tools) {
    const kind = classify(t.name);
    const path = pathFromInput(t.input);
    if (kind === 'meta') continue;
    ledger.push({ tool: t.name, kind, path, args_preview: JSON.stringify(t.input).slice(0, 120) });

    if (kind === 'neuron_mcp') neuronMcp = true;
    if (kind === 'shell') {
      const cmd = String(t.input?.command || '');
      if (/neuron|apps\\cli\\dist\\index\.js|apps\/cli\/dist\/index\.js/i.test(cmd) && /context/i.test(cmd)) {
        neuronCliShell = true;
      }
    }

    if (kind === 'read' || kind === 'edit') {
      if (path) {
        if (!firstUseful) {
          if (isUseful(path, gold)) firstUseful = path;
          else {
            readsBeforeUseful += 1;
            if (isNoise(path) || (gold.length && !isUseful(path, gold))) wrongFiles += 1;
          }
        } else if (isNoise(path)) {
          wrongFiles += 1;
        }
      }
    }
  }

  const kinds = ledger.map((e) => e.kind);
  const list_dir = kinds.filter((k) => k === 'list_dir').length;
  const grep = kinds.filter((k) => k === 'grep').length;
  const reads = kinds.filter((k) => k === 'read').length;
  const edits = kinds.filter((k) => k === 'edit').length;
  const shells = kinds.filter((k) => k === 'shell').length;
  const exploration = list_dir + grep + reads;

  // Rediscovery: broad discovery after having a useful file, OR arm B still doing glob+multi grep
  const firstUsefulIdx = ledger.findIndex(
    (e) => (e.kind === 'read' || e.kind === 'edit') && e.path && isUseful(e.path, gold),
  );
  const rediscovery =
    taskId === 'T13'
      ? false
      : list_dir + grep >= 3 ||
        (firstUsefulIdx >= 0 &&
          ledger.slice(firstUsefulIdx + 1).filter((e) => e.kind === 'list_dir' || e.kind === 'grep')
            .length >= 2);

  const firstTool = ledger[0]?.tool ?? null;
  const correctStart =
    taskId === 'T13'
      ? !ledger.some((e) => e.path && /kubernetes|terraform/i.test(e.path || ''))
      : Boolean(firstUseful) && readsBeforeUseful <= 2;

  // neuron path used
  const neuron_first =
    arm === 'B' &&
    (neuronMcp
      ? classify(ledger[0]?.tool || '') === 'neuron_mcp'
      : neuronCliShell && ledger.findIndex((e) => e.kind === 'shell') === 0);

  return {
    key,
    task_id: taskId,
    arm,
    agent_id: agentId,
    transcript,
    TRACE_QUALITY: 'HARD_TOOL_USE',
    tool_events: ledger.length,
    ledger_short: ledger.slice(0, 20).map((e) => `${e.kind}:${e.tool}${e.path ? `(${e.path.split('/').slice(-2).join('/')})` : ''}`),
    list_dir,
    grep,
    file_reads: reads,
    edits,
    shells,
    exploration_calls: exploration,
    first_useful_file: firstUseful,
    files_before_useful: firstUseful == null ? readsBeforeUseful : Math.min(readsBeforeUseful, reads),
    wrong_files: wrongFiles,
    rediscovery,
    correct_start: correctStart,
    neuron_mcp_calls: ledger.filter((e) => e.kind === 'neuron_mcp').length,
    neuron_cli_shell: neuronCliShell,
    neuron_first: Boolean(neuron_first),
    mcp_neuron_context: false, // never observed in wave1
  };
}

function mean(xs) {
  const a = xs.filter((x) => typeof x === 'number');
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
}
function median(xs) {
  const a = xs.filter((x) => typeof x === 'number').sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function agg(rows, arm) {
  const r = rows.filter((x) => x.arm === arm && !x.error);
  return {
    n: r.length,
    exploration_median: median(r.map((x) => x.exploration_calls)),
    exploration_mean: mean(r.map((x) => x.exploration_calls)),
    file_reads_median: median(r.map((x) => x.file_reads)),
    grep_median: median(r.map((x) => x.grep)),
    rediscovery_rate: r.filter((x) => x.rediscovery).length / r.length,
    correct_start_rate: r.filter((x) => x.correct_start).length / r.length,
    neuron_first_rate: r.filter((x) => x.neuron_first).length / r.length,
    neuron_cli_rate: r.filter((x) => x.neuron_cli_shell).length / r.length,
    mcp_neuron_context_rate: r.filter((x) => x.mcp_neuron_context).length / r.length,
    wrong_files_mean: mean(r.map((x) => x.wrong_files)),
    files_before_useful_median: median(r.map((x) => x.files_before_useful)),
  };
}

const scored = Object.entries(WAVE1).map(([k, id]) => scoreRun(k, id));
const A = agg(scored, 'A');
const B = agg(scored, 'B');

// Diff-based rule adherence for T02/T11
function ruleAdherence(taskId, arm) {
  const pay = join(repo, '.tmp', `work-${taskId}-${arm}`, 'src', 'api', 'routes', 'payments.ts');
  if (!existsSync(pay)) return { checked: false };
  const txt = readFileSync(pay, 'utf8');
  const hasRefund = /refund/i.test(txt);
  const stripeInRoute =
    /from ['"].*stripe['"]/i.test(txt) || /StripeClient/.test(txt);
  const usesPaymentService = /PaymentService|payments\.refund/i.test(txt);
  return {
    checked: true,
    hasRefundRoute: hasRefund,
    called_stripe_from_route: stripeInRoute,
    used_payment_service: usesPaymentService,
    rule_ok: hasRefund && usesPaymentService && !stripeInRoute,
  };
}

const rules = {
  'T02-A': ruleAdherence('T02', 'A'),
  'T02-B': ruleAdherence('T02', 'B'),
  'T11-A': ruleAdherence('T11', 'A'),
  'T11-B': ruleAdherence('T11', 'B'),
};

const report = {
  generatedAt: new Date().toISOString(),
  wave: 'final-attempt-wave1-hard-rescore + MCP probe',
  LIVE_AGENT_PROOF: 'PARTIAL',
  TRACE_QUALITY: 'HARD_TOOL_USE',
  MCP_PROOF: 'UNAVAILABLE',
  REPEATABILITY: 'UNAVAILABLE',
  TASK_SUCCESS: 'PARTIAL',
  REDISCOVERY_REDUCTION: 'PARTIAL',
  RULE_ADHERENCE: 'MEASURED_DIFF',
  product_verdict: 'PROMISING BUT UNPROVEN',
  planned: { tasks: 20, runs: 2, arms: 2, total: 80 },
  completed: {
    hard_rescored_wave1: scored.filter((s) => !s.error).length,
    new_mcp_runs: 0,
    failed: 0,
  },
  mcp_probe: {
    product_stdio_neuron_context: true,
    note: 'Stdio MCP against fixture exposes neuron_context and returns PaymentService rule + payments.ts',
    cursor_task_mcp: {
      neuron_context_available: false,
      tools_listed_legacy: true,
      call_mcp_tool: 'fails with -32602 Tool not found for all neuron_* including after mcp_auth',
      probe_agent: 'd19ef822-44bf-40c7-9b6a-7788aeb7ee6b',
    },
    blocker:
      'Cursor Task subagents inherit workspace MCP (stale legacy catalog). CallMcpTool cannot invoke tools. Task API cannot attach per-fixture mcpServers with NEURON_CWD=fixture. Therefore product path Cursor→MCP→neuron_context→ProjectBrain cannot be measured via Task in this environment.',
  },
  hard_trace_wave1: {
    aggregates: { baseline: A, neuron_cli_arm: B },
    comparison_vs_self_report: {
      note: 'Self-report claimed B rediscovery 0% and neuron_first 100%. Hard tool_use shows B still greps/globs; neuron path was CLI Shell, not MCP neuron_context.',
      self_report_rediscovery_B: 0,
      hard_rediscovery_B: B.rediscovery_rate,
      self_report_exploration_delta: -0.294,
      hard_exploration_median_A: A.exploration_median,
      hard_exploration_median_B: B.exploration_median,
    },
    runs: scored,
    rule_diffs: rules,
  },
  why_not_proven: [
    'MCP_PROOF = UNAVAILABLE (Task cannot call product neuron_context)',
    'Wave1 Neuron arm used CLI Shell, not MCP',
    'Only 8×1 completed previously; 20×2×A/B = 80 not runnable under broken MCP without faking CLI-as-MCP',
    'Self-reported rediscovery was optimistic vs hard traces',
  ],
  how_to_unblock_mcp_proof: [
    'In Cursor: toggle Neuron MCP off/on or restart so catalog shows neuron_context (7-tool product surface), not legacy neuron_prepare_task list',
    'Fix CallMcpTool −32602 (tools discoverable but not invokable)',
    'Point NEURON_CWD at disposable fixture (or give Task/SDK per-run mcpServers with fixture cwd)',
    'OR set usable CURSOR_API_KEY and run scripts/live-agent-validation.mjs with @cursor/sdk mcpServers.neuron → neuron_context',
    'Then re-run 20 tasks × 2 × A/B with transcript tool_use scoring',
  ],
};

writeFileSync(join(repo, 'live-agent-validation-report.json'), JSON.stringify(report, null, 2));

const fmt = (n) =>
  n == null ? 'UNAVAILABLE' : typeof n === 'number' ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(n);

const md = `# Live agent validation

**Date:** ${report.generatedAt.slice(0, 10)}  
**Evidence:** [\`live-agent-validation-report.json\`](../live-agent-validation-report.json)

---

## Verdict

# PROMISING BUT UNPROVEN

| Label | Value |
| --- | --- |
| \`LIVE_AGENT_PROOF\` | **PARTIAL** |
| \`TRACE_QUALITY\` | **HARD_TOOL_USE** (transcript \`tool_use\` ledger) |
| \`MCP_PROOF\` | **UNAVAILABLE** |
| \`REPEATABILITY\` | **UNAVAILABLE** (20×2 not completed under MCP) |
| \`TASK_SUCCESS\` | PARTIAL (wave1 only; not MCP path) |
| \`REDISCOVERY_REDUCTION\` | PARTIAL (hard traces weaken self-report claim) |
| \`RULE_ADHERENCE\` | **MEASURED_DIFF** on T02/T11 workdirs |

**PROVEN is not allowed:** product MCP path was not exercised by Task agents.

---

## 1. MCP probe (blocking)

### Product MCP (stdio → fixture) — works

\`\`\`text
neuron_context ✓
recommended start: src/api/routes/payments.ts
rules: Never call Stripe directly from route handlers
\`\`\`

### Cursor Task / workspace MCP — broken for this proof

Probe agent [\`MCP availability probe\`](d19ef822-44bf-40c7-9b6a-7788aeb7ee6b):

- \`neuron_context\` **not listed**
- Legacy tools listed (\`neuron_prepare_task\`, \`neuron_get_context\`, …)
- Every \`CallMcpTool\` → \`MCP error -32602: Tool … not found\` (even after \`mcp_auth\`)
- Task API **cannot** attach per-run \`mcpServers\` with \`NEURON_CWD=<fixture>\`

\`\`\`text
Cursor Task
  ✗  MCP neuron_context (product)
  ✗  fixture-scoped ProjectBrain via MCP
\`\`\`

Therefore we **do not** treat CLI \`neuron context\` as MCP proof.

---

## 2. Planned vs completed

| | Count |
| --- | ---: |
| Planned (20 × 2 × A/B) | **80** |
| Completed under product MCP | **0** |
| Hard-rescored prior Task runs (CLI Neuron arm) | **16** |
| Failed MCP invocations in probe | all listed neuron_* tools |

Sample size was **not** silently reduced to claim PROVEN.

---

## 3. Hard tool_use rescore of prior wave1 (not MCP)

Self-report said B rediscovery **0%** / exploration **−29%**.  
Transcript \`tool_use\` ledger:

| Metric | Baseline A | Neuron CLI B |
| --- | ---: | ---: |
| exploration calls (median) | ${fmt(A.exploration_median)} | ${fmt(B.exploration_median)} |
| file reads (median) | ${fmt(A.file_reads_median)} | ${fmt(B.file_reads_median)} |
| grep (median) | ${fmt(A.grep_median)} | ${fmt(B.grep_median)} |
| rediscovery rate | ${fmt(A.rediscovery_rate)} | ${fmt(B.rediscovery_rate)} |
| correct start rate | ${fmt(A.correct_start_rate)} | ${fmt(B.correct_start_rate)} |
| neuron CLI first | — | ${fmt(B.neuron_first_rate)} |
| MCP neuron_context usage | 0 | **0** |

Interpretation: CLI guidance still helps some runs, but **hard traces show continued grep/glob** — the earlier “rediscovery 0%” self-report was too optimistic. This is **not** final product proof.

### Rule adherence (diff, T02/T11)

| Run | refund route | PaymentService | Stripe in route | rule_ok |
| --- | --- | --- | --- | --- |
| T02-A | ${rules['T02-A'].hasRefundRoute} | ${rules['T02-A'].used_payment_service} | ${rules['T02-A'].called_stripe_from_route} | ${rules['T02-A'].rule_ok} |
| T02-B | ${rules['T02-B'].hasRefundRoute} | ${rules['T02-B'].used_payment_service} | ${rules['T02-B'].called_stripe_from_route} | ${rules['T02-B'].rule_ok} |
| T11-A | ${rules['T11-A'].hasRefundRoute} | ${rules['T11-A'].used_payment_service} | ${rules['T11-A'].called_stripe_from_route} | ${rules['T11-A'].rule_ok} |
| T11-B | ${rules['T11-B'].hasRefundRoute} | ${rules['T11-B'].used_payment_service} | ${rules['T11-B'].called_stripe_from_route} | ${rules['T11-B'].rule_ok} |

---

## 4. Target metrics table (final MCP run)

| Metric | Baseline | NeuronAI | Delta |
| --- | ---: | ---: | ---: |
| task success | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| correct start | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| rediscovery rate | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| exploration calls | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| file reads | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| search calls | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| first useful file | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| wrong files | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| rule adherence | see diff table | see diff table | — |
| unnecessary exploration | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |
| MCP neuron_context usage | — | **0 (blocked)** | — |
| tokens / latency | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE |

---

## 5. How to unblock true FINAL validation

1. Reload Cursor Neuron MCP until tools are exactly: \`neuron_context\`, \`neuron_search\`, \`neuron_remember\`, … (product 7-tool surface).
2. Ensure \`CallMcpTool\` can invoke them (fix −32602).
3. Set MCP \`NEURON_CWD\` to disposable fixture (or SDK \`mcpServers\` per run).
4. Run \`20 × 2 × A/B\` with hard transcript scoring (\`scripts/score-live-agent-transcripts.mjs\`).
5. Or: usable \`CURSOR_API_KEY\` + \`scripts/live-agent-validation.mjs\` (\`@cursor/sdk\` + inline MCP).

Harness pieces ready: fixture builder, transcript hard scorer, SDK runner path. **No architecture changes made.**

---

## 6. Answers (stop — no P5)

1. **What we proved:** Task subagents can execute real coding tasks; product \`neuron_context\` works over stdio on a fixture; hard \`tool_use\` ledgers exist in transcripts; Stripe/PaymentService rule can be verified from diffs.
2. **What we did not prove:** Cursor Agent → **MCP \`neuron_context\`** → less rediscovery at 20×2 scale.
3. **Advantage vs plain agent?** Suggestive under CLI, but **not proven** on the product MCP path; hard traces weaken the wave1 self-report.
4. **Largest remaining product gap:** **MCP integration reliability in Cursor** (stale catalog + non-invokable tools + no per-task fixture MCP binding for Task).
5. **Publish / use vs build more?** **Use for CLI + local brain value; do not claim MCP live-agent PROVEN until the unblock list above is green.** Do not expand architecture now.
`;

writeFileSync(join(repo, 'docs', 'LIVE_AGENT_VALIDATION.md'), md);
console.log(
  JSON.stringify(
    {
      verdict: report.product_verdict,
      MCP_PROOF: report.MCP_PROOF,
      TRACE_QUALITY: report.TRACE_QUALITY,
      A,
      B,
      rules,
    },
    null,
    2,
  ),
);
