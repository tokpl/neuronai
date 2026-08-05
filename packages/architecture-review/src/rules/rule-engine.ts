import type {
  DependencyEdge,
  ModuleNode,
  RuleViolation,
} from '../types.js';

export interface ArchitectureRule {
  id: string;
  description: string;
  check: (ctx: RuleContext) => RuleViolation[];
}

export interface RuleContext {
  modules: ModuleNode[];
  edges: DependencyEdge[];
}

const BUILTIN_RULES: ArchitectureRule[] = [
  {
    id: 'core-no-app-deps',
    description: 'Core cannot depend on application',
    check: (ctx) => {
      const violations: RuleViolation[] = [];
      for (const e of ctx.edges) {
        const from = ctx.modules.find((m) => m.id === e.from);
        const to = ctx.modules.find((m) => m.id === e.to);
        if (from?.layer === 'core' && to?.layer === 'application') {
          violations.push({
            ruleId: 'core-no-app-deps',
            severity: 'high',
            message: `Core module "${from.name}" depends on application "${to.name}"`,
            location: `${e.from}→${e.to}`,
          });
        }
      }
      return violations;
    },
  },
  {
    id: 'interface-communication',
    description: 'Modules communicate through interfaces',
    check: (ctx) => {
      const violations: RuleViolation[] = [];
      // Heuristic: high fan-out without a clear facade/api module name
      for (const m of ctx.modules) {
        const fanOut = ctx.edges.filter((e) => e.from === m.id).length;
        const name = m.name.toLowerCase();
        if (fanOut >= 5 && !/facade|api|interface|port|adapter/.test(name)) {
          violations.push({
            ruleId: 'interface-communication',
            severity: 'medium',
            message: `"${m.name}" has high outbound coupling without an interface/facade naming cue`,
            location: m.id,
          });
        }
      }
      return violations;
    },
  },
  {
    id: 'security-not-bypassed',
    description: 'Security layer cannot be bypassed',
    check: (ctx) => {
      const violations: RuleViolation[] = [];
      const security = ctx.modules.filter((m) => m.layer === 'security');
      if (!security.length) return violations;
      const secIds = new Set(security.map((m) => m.id));
      // Application talking to storage without going through security is a soft warning when security exists
      for (const e of ctx.edges) {
        const from = ctx.modules.find((m) => m.id === e.from);
        const to = ctx.modules.find((m) => m.id === e.to);
        if (
          from?.layer === 'application' &&
          to?.layer === 'storage' &&
          !ctx.edges.some(
            (x) => x.from === e.from && secIds.has(x.to),
          )
        ) {
          violations.push({
            ruleId: 'security-not-bypassed',
            severity: 'high',
            message: `Application "${from.name}" reaches storage "${to.name}" without a security-layer dependency edge`,
            location: `${e.from}→${e.to}`,
          });
        }
      }
      return violations;
    },
  },
  {
    id: 'storage-abstraction',
    description: 'Storage must use abstraction',
    check: (ctx) => {
      const violations: RuleViolation[] = [];
      for (const m of ctx.modules) {
        const resp = (m.responsibilities ?? []).join(' ').toLowerCase();
        if (
          m.layer !== 'storage' &&
          /(better-sqlite|pg\.|prisma|mongoose|raw sql)/i.test(resp)
        ) {
          violations.push({
            ruleId: 'storage-abstraction',
            severity: 'medium',
            message: `"${m.name}" appears to embed concrete DB access — use a storage abstraction`,
            location: m.id,
          });
        }
      }
      return violations;
    },
  },
];

export class ArchitectureRuleEngine {
  constructor(private readonly rules: ArchitectureRule[] = BUILTIN_RULES) {}

  evaluate(ctx: RuleContext): RuleViolation[] {
    return this.rules.flatMap((r) => r.check(ctx));
  }

  listRules(): Array<{ id: string; description: string }> {
    return this.rules.map((r) => ({ id: r.id, description: r.description }));
  }
}

export function createArchitectureRuleEngine(
  rules?: ArchitectureRule[],
): ArchitectureRuleEngine {
  return new ArchitectureRuleEngine(rules);
}
