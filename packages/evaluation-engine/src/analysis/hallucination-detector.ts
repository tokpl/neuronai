import type {
  HallucinationContext,
  HallucinationFinding,
  HallucinationReport,
} from '../types.js';

export type { HallucinationContext };

/**
 * HallucinationDetector — unsupported claims, invented files, unknown decisions.
 * Heuristic only — no model training.
 */
export class HallucinationDetector {
  detect(answer: string, ctx: HallucinationContext): HallucinationReport {
    const findings: HallucinationFinding[] = [];
    const known = ctx.knownFacts.map((f) => f.toLowerCase());
    const knownFiles = (ctx.knownFiles ?? []).map((f) => f.replace(/\\/g, '/').toLowerCase());
    const knownDecisions = (ctx.knownDecisions ?? []).map((d) => d.toLowerCase());

    const techClaims = [
      { re: /\bredis\b/i, label: 'Redis' },
      { re: /\bkafka\b/i, label: 'Kafka' },
      { re: /\bmongodb\b/i, label: 'MongoDB' },
      { re: /\belasticsearch\b/i, label: 'Elasticsearch' },
      { re: /\bkubernetes\b|\bk8s\b/i, label: 'Kubernetes' },
    ];
    for (const claim of techClaims) {
      if (claim.re.test(answer)) {
        const inGraph = known.some((k) => k.includes(claim.label.toLowerCase()));
        if (!inGraph) {
          findings.push({
            claim: `There is ${claim.label}`,
            kind: 'unsupported_claim',
            severity: 'high',
            evidence: `Answer mentions ${claim.label} but project facts/graph have no ${claim.label}.`,
          });
        }
      }
    }

    const fileMentions = answer.match(
      /(?:^|[\s`"'(])((?:src|apps|packages|lib)\/[\w./-]+\.[a-z]{1,4})/gi,
    );
    for (const raw of fileMentions ?? []) {
      const path = raw.trim().replace(/^[`"'()]/, '').toLowerCase();
      if (!path.includes('/')) continue;
      const exists =
        knownFiles.length === 0 ||
        knownFiles.some((f) => f.endsWith(path) || f.includes(path) || path.includes(f));
      if (knownFiles.length && !exists) {
        findings.push({
          claim: path,
          kind: 'invented_file',
          severity: 'high',
          evidence: `Referenced file not found in known project files.`,
        });
      }
    }

    const decisionMentions = answer.match(
      /(?:we (?:decided|chose|use|adopted)|decision[:\s]+)([^.!?\n]{8,80})/gi,
    );
    for (const m of decisionMentions ?? []) {
      const snippet = m.toLowerCase();
      const matched = knownDecisions.some(
        (d) => snippet.includes(d.slice(0, 20)) || d.includes(snippet.slice(0, 20)),
      );
      if (knownDecisions.length && !matched) {
        findings.push({
          claim: m.slice(0, 120),
          kind: 'unknown_decision',
          severity: 'medium',
          evidence: 'Decision-like claim not found in known decision titles.',
        });
      }
    }

    if (
      /\b(always|never|guarantees?|definitely)\b/i.test(answer) &&
      !/\b(because|according to|from memory|see |per )\b/i.test(answer) &&
      known.length > 0
    ) {
      findings.push({
        claim: 'Absolute claim without evidence',
        kind: 'missing_evidence',
        severity: 'low',
        evidence: 'Strong wording without linking to project memories/decisions.',
      });
    }

    const ok = findings.filter((f) => f.severity !== 'low').length === 0;
    return {
      ok,
      findings,
      summary: ok
        ? 'No high/medium hallucination signals.'
        : `${findings.length} finding(s): ${findings.map((f) => f.kind).join(', ')}`,
    };
  }
}

export function createHallucinationDetector(): HallucinationDetector {
  return new HallucinationDetector();
}
