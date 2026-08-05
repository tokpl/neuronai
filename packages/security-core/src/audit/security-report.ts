import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  InjectionFinding,
  SecretFinding,
  SecurityAuditEntry,
  SecurityContext,
  SourceTrustReport,
} from '../types.js';
import { nowIso } from '../types.js';

export interface SecurityReportInput {
  context: SecurityContext;
  secrets: SecretFinding[];
  injections?: InjectionFinding[];
  trust?: SourceTrustReport[];
  blockedActions: string[];
  audit?: SecurityAuditEntry[];
  recommendations?: string[];
}

export function renderSecurityReport(input: SecurityReportInput): string {
  const recs =
    input.recommendations ??
    defaultRecommendations(input);

  const lines = [
    '# Neuron Security Report',
    '',
    `_Generated ${nowIso()}_`,
    '',
    '## Secrets',
    '',
  ];

  if (!input.secrets.length) {
    lines.push('_No secret patterns detected in scanned context._');
  } else {
    for (const s of input.secrets) {
      lines.push(
        `- **${s.kind}** (${s.severity}) @ \`${s.location}\` — ${s.evidence}`,
      );
    }
  }

  lines.push('', '## Risks', '');
  if (input.injections?.length) {
    for (const i of input.injections) {
      lines.push(`- Injection (${i.severity}): \`${i.pattern}\` in ${i.sourceHint}`);
    }
  } else {
    lines.push('_No high prompt-injection patterns in this scan._');
  }
  if (input.trust?.length) {
    lines.push('', '### Source trust', '');
    for (const t of input.trust) {
      lines.push(`- \`${t.path}\` → **${t.trustLevel}** (${t.score}) — ${t.reasons[0]}`);
    }
  }

  lines.push('', '## Blocked actions', '');
  if (!input.blockedActions.length) {
    lines.push('_None recorded in this session._');
  } else {
    for (const b of input.blockedActions) {
      lines.push(`- ${b}`);
    }
  }

  lines.push('', '## Policies', '');
  lines.push(`- Privacy mode: **${input.context.privacyMode}**`);
  lines.push(`- Project trust: **${input.context.trustLevel}**`);
  lines.push(`- Data classification: **${input.context.dataClassification}**`);
  for (const p of input.context.policies) {
    lines.push(`- ${p.id}: ${p.enabled ? 'ON' : 'OFF'} — ${p.description}`);
  }
  lines.push('', '### Tool permissions', '');
  for (const perm of input.context.permissions) {
    lines.push(`- ${perm.id}: **${perm.effect}**`);
  }

  lines.push('', '## Recommendations', '');
  for (const r of recs) {
    lines.push(`- ${r}`);
  }

  lines.push(
    '',
    '---',
    '',
    '_Neuron protects itself and project data. No antivirus, EDR, or auto-deploy of security patches._',
    '',
  );

  return lines.join('\n');
}

function defaultRecommendations(input: SecurityReportInput): string[] {
  const out: string[] = [];
  if (input.secrets.length) {
    out.push('Sanitize context with neuron_check_context before AI analysis');
    out.push('Rotate any live credentials that may have been exposed in the workspace');
  }
  if (input.injections?.some((i) => i.severity === 'high')) {
    out.push('Treat recently edited README/docs as LIMITED trust until reviewed');
  }
  if (input.context.privacyMode !== 'LOCAL_ONLY') {
    out.push('Confirm cloud AI providers are intentional under current PrivacyMode');
  }
  out.push('Keep delete_files and run_script blocked unless explicitly approved');
  return out;
}

export async function writeSecurityReport(
  neuronDir: string,
  input: SecurityReportInput,
  filename = 'security-report.md',
): Promise<string> {
  await mkdir(neuronDir, { recursive: true });
  const path = join(neuronDir, filename);
  await writeFile(path, renderSecurityReport(input), 'utf8');
  return path;
}
