#!/usr/bin/env node
/**
 * Live agent A/B benchmark infrastructure (P4).
 *
 * IMPORTANT
 * ---------
 * This file defines the reproducible harness + metrics schema for comparing:
 *   A) Baseline agent WITHOUT NeuronAI
 *   B) Agent WITH neuron_context first
 *
 * It does NOT invent live-agent numbers.
 *
 * If CURSOR_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY are unset:
 *   LIVE_AGENT_PROOF = UNAVAILABLE
 *
 * Scripted exploration remains a separate measurement:
 *   EXPLORATION_POLICY_PROOF → scripts/real-agent-benchmark.mjs
 *
 * Usage:
 *   node scripts/live-agent-benchmark.mjs
 *   node scripts/live-agent-benchmark.mjs --dry-run   # write UNAVAILABLE report only
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(repo, 'live-agent-benchmark-report.json');

/** ≥30 realistic coding-agent tasks. Gold paths are for grading — not prompts. */
export const LIVE_AGENT_TASKS = [
  // Locate
  { id: 'L1', category: 'locate', prompt: 'Where is authentication implemented?', gold: [/auth/i] },
  { id: 'L2', category: 'locate', prompt: 'Where are API routes?', gold: [/route|api/i] },
  { id: 'L3', category: 'locate', prompt: 'Where is database access?', gold: [/db|repository|database/i] },
  { id: 'L4', category: 'locate', prompt: 'Where is billing?', gold: [/billing|payment|invoice/i] },
  { id: 'L5', category: 'locate', prompt: 'Where are background jobs?', gold: [/worker|job/i] },
  // Modify
  { id: 'M1', category: 'modify', prompt: 'Add invoice cancellation.', gold: [/invoice|payment|cancel/i] },
  { id: 'M2', category: 'modify', prompt: 'Add a payment endpoint.', gold: [/payment|route/i] },
  { id: 'M3', category: 'modify', prompt: 'Add authentication middleware.', gold: [/auth|middleware/i] },
  { id: 'M4', category: 'modify', prompt: 'Change retry behavior.', gold: [/retry|payment|db|worker/i], soft: true },
  { id: 'M5', category: 'modify', prompt: 'Add a background worker.', gold: [/worker|job/i] },
  { id: 'M6', category: 'modify', prompt: 'Add validation to an existing endpoint.', gold: [/route|payment|valid/i], soft: true },
  // Debug
  { id: 'D1', category: 'debug', prompt: 'Fix payment failures.', gold: [/payment/i] },
  { id: 'D2', category: 'debug', prompt: 'Fix authentication bug.', gold: [/auth/i] },
  { id: 'D3', category: 'debug', prompt: 'Fix incorrect invoice calculation.', gold: [/invoice|billing|payment/i] },
  { id: 'D4', category: 'debug', prompt: 'Fix database timeout.', gold: [/db|repository|client/i], soft: true },
  { id: 'D5', category: 'debug', prompt: 'Fix webhook handling.', gold: [/webhook|payment|stripe/i], soft: true },
  // Impact
  { id: 'I1', category: 'impact', prompt: 'What breaks if PaymentService changes?', gold: [/payment/i] },
  { id: 'I2', category: 'impact', prompt: 'Who depends on BillingService?', gold: [/billing|invoice|payment/i], soft: true },
  { id: 'I3', category: 'impact', prompt: 'What tests need changing for payments?', gold: [/test|payment/i] },
  { id: 'I4', category: 'impact', prompt: 'What routes use PaymentService?', gold: [/route|payment/i] },
  // Rules
  { id: 'R1', category: 'rules', prompt: 'What conventions apply when adding an endpoint?', gold: [/rule|convention|route|stripe/i], soft: true },
  { id: 'R2', category: 'rules', prompt: 'What payment rules exist?', gold: [/stripe|payment|rule/i] },
  { id: 'R3', category: 'rules', prompt: 'What architecture decision affects payments?', gold: [/payment|decision/i] },
  // Negative
  { id: 'N1', category: 'negative', prompt: 'Where is Terraform?', negative: true },
  { id: 'N2', category: 'negative', prompt: 'Where is Kafka?', negative: true },
  { id: 'N3', category: 'negative', prompt: 'Where is Kubernetes deployment?', negative: true },
  { id: 'N4', category: 'negative', prompt: 'Where is GraphQL?', negative: true },
  { id: 'N5', category: 'negative', prompt: 'Where is AWS Lambda?', negative: true },
  { id: 'N6', category: 'negative', prompt: 'How does the React Native mobile app work?', negative: true },
  // Combined
  { id: 'C1', category: 'modify', prompt: 'Where should I start to add refund support?', gold: [/payment|stripe|refund/i], soft: true },
  { id: 'C2', category: 'modify', prompt: 'Add support for cancelling invoices and follow project rules.', gold: [/invoice|payment|cancel|stripe/i] },
  { id: 'C3', category: 'debug', prompt: 'Why is the API returning 403 on payments?', gold: [/auth|middleware|403/i], soft: true },
];

/**
 * Metrics schema for a single arm × task. All fields are nullable so UNAVAILABLE
 * can be recorded without inventing zeros.
 */
export const METRIC_FIELDS = [
  'tool_calls',
  'file_reads',
  'grep_calls',
  'directory_listings',
  'first_useful_file',
  'first_correct_location',
  'time_to_first_useful_action_ms',
  'total_prompt_tokens',
  'total_completion_tokens',
  'context_tokens',
  'wall_clock_ms',
  'final_task_success',
  'unnecessary_exploration',
  'neuron_context_calls',
];

function credentialsPresent() {
  return Boolean(
    process.env.CURSOR_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
}

function priorScriptedSummary() {
  const p = join(repo, 'real-agent-benchmark-report.json');
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return {
      label: 'EXPLORATION_POLICY_PROOF',
      product_impact: j.product_impact ?? j.final_verdict ?? null,
      note: 'Scripted policy — not live LLM agent traces',
    };
  } catch {
    return null;
  }
}

function buildUnavailableReport(reason) {
  return {
    generatedAt: new Date().toISOString(),
    LIVE_AGENT_PROOF: 'UNAVAILABLE',
    reason,
    methodology: {
      arms: ['baseline_no_neuron', 'neuron_context_first'],
      tasks: LIVE_AGENT_TASKS.length,
      metrics: METRIC_FIELDS,
      labels: {
        LIVE_AGENT_PROOF: 'Measured from real LLM/Cursor agent tool traces',
        EXPLORATION_POLICY_PROOF: 'Scripted exploration policy (real-agent-benchmark.mjs)',
        Brain_compression: 'contextTokens vs corpusTokens — NOT agent token savings',
      },
    },
    environment: {
      CURSOR_API_KEY: Boolean(process.env.CURSOR_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      node: process.version,
    },
    tasks: LIVE_AGENT_TASKS.map((t) => ({
      id: t.id,
      category: t.category,
      prompt: t.prompt,
      baseline: null,
      neuron: null,
      status: 'UNAVAILABLE',
    })),
    aggregates: {
      baseline: null,
      neuron: null,
      comparison: null,
    },
    related: {
      scripted: priorScriptedSummary(),
    },
    how_to_enable: [
      'Set CURSOR_API_KEY or ANTHROPIC_API_KEY (or OPENAI_API_KEY) in the environment.',
      'Implement a runner that drives a real coding agent with tool-call telemetry.',
      'Record METRIC_FIELDS for each arm × task without inventing missing values.',
      'Keep LIVE_AGENT_PROOF separate from EXPLORATION_POLICY_PROOF forever.',
    ],
    verdict: 'LIVE_AGENT_PROOF = UNAVAILABLE',
  };
}

/**
 * Placeholder for a future live runner. Deliberately refuses to invent metrics
 * even when credentials are present — shipping a stub that claims success would
 * violate P4 honesty rules.
 */
async function runLiveIfPossible() {
  if (!credentialsPresent()) {
    return buildUnavailableReport('No CURSOR_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY');
  }

  // Credentials exist but a real multi-turn Cursor/Claude harness is not wired
  // into this OSS tree (no SDK agent loop that records tool events). Refuse to fake it.
  const report = buildUnavailableReport(
    'Credentials present, but live multi-turn agent runner is not implemented in this repository — refusing to invent traces',
  );
  report.LIVE_AGENT_PROOF = 'UNAVAILABLE';
  report.credentialsPresent = true;
  report.verdict =
    'LIVE_AGENT_PROOF = UNAVAILABLE (credentials present; harness runner not enabled)';
  return report;
}

async function main() {
  const report = await runLiveIfPossible();
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`LIVE_AGENT_PROOF = ${report.LIVE_AGENT_PROOF}`);
  console.log(`Tasks defined: ${LIVE_AGENT_TASKS.length}`);
  if (report.related?.scripted) {
    console.log(`Related scripted proof: ${JSON.stringify(report.related.scripted)}`);
  }
  process.exitCode = report.LIVE_AGENT_PROOF === 'UNAVAILABLE' ? 0 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
