import type {
  BoundaryFinding,
  CircularDependency,
  ComplexityFinding,
  EffortEstimate,
  RefactoringPlan,
  RuleViolation,
} from '../types.js';
import { newId } from '../types.js';

/**
 * Generates refactor plans — does NOT change code.
 */
export class RefactoringPlanner {
  fromCircular(circular: CircularDependency[]): RefactoringPlan[] {
    return circular.map((c) => ({
      id: newId('ref'),
      problem: c.warning,
      impact: 'Circular deps block independent evolution and testing',
      suggestedSteps: [
        'Identify the shared contract / interface',
        'Extract interface into a neutral module',
        'Invert one dependency direction',
        'Add a boundary test that forbids the cycle',
      ],
      risk: 'Medium — may touch multiple packages; do one edge at a time',
      estimatedEffort: effortForCycle(c.cycle.length),
      location: c.cycle.join(' → '),
    }));
  }

  fromBoundaries(findings: BoundaryFinding[]): RefactoringPlan[] {
    return findings.map((f) => ({
      id: newId('ref'),
      problem: f.issue,
      impact: 'Unclear module boundaries increase coupling and review cost',
      suggestedSteps: [
        f.recommendation,
        'Define a public facade for the module',
        'Move mismatched logic to the owning package',
        'Document the new responsibility in architecture.md',
      ],
      risk: 'Medium — split carefully to avoid breaking imports',
      estimatedEffort: 'M',
      location: f.moduleId,
    }));
  }

  fromComplexity(findings: ComplexityFinding[]): RefactoringPlan[] {
    return findings.slice(0, 10).map((f) => ({
      id: newId('ref'),
      problem: f.detail,
      impact: 'High complexity raises defect risk and slows reviews',
      suggestedSteps: [
        'Extract cohesive helpers or submodules',
        'Reduce nesting with early returns',
        'Add focused unit tests before moving code',
      ],
      risk: 'Low–Medium — prefer incremental extraction',
      estimatedEffort: f.kind === 'large_file' ? 'L' : 'M',
      location: f.location,
    }));
  }

  fromRules(violations: RuleViolation[]): RefactoringPlan[] {
    return violations.map((v) => ({
      id: newId('ref'),
      problem: v.message,
      impact: `Architecture rule violated: ${v.ruleId}`,
      suggestedSteps: [
        'Confirm the intended layering with the team',
        'Introduce an interface or move the dependency',
        'Re-run neuron_architecture_scan after the change',
      ],
      risk: v.severity === 'high' || v.severity === 'critical' ? 'High' : 'Medium',
      estimatedEffort: 'M',
      location: v.location,
    }));
  }

  planAll(input: {
    circular: CircularDependency[];
    boundaries: BoundaryFinding[];
    complexity: ComplexityFinding[];
    rules: RuleViolation[];
  }): RefactoringPlan[] {
    return [
      ...this.fromCircular(input.circular),
      ...this.fromBoundaries(input.boundaries),
      ...this.fromComplexity(input.complexity),
      ...this.fromRules(input.rules),
    ].slice(0, 40);
  }
}

function effortForCycle(len: number): EffortEstimate {
  if (len <= 2) return 'S';
  if (len <= 3) return 'M';
  if (len <= 5) return 'L';
  return 'XL';
}

export function createRefactoringPlanner(): RefactoringPlanner {
  return new RefactoringPlanner();
}
