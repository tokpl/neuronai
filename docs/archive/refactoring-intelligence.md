# Refactoring intelligence

`RefactoringPlanner` turns findings into **plans**, not patches:

- Problem
- Impact
- Suggested steps
- Risk
- Estimated effort (`S`–`XL`)

`TechnicalDebtMemory` stores issue / impact / location / priority / history under `.neuron/architecture-review.json`.

## Example

```text
Problem: Circular dependency: A → B → A
Impact: Blocks independent evolution and testing
Steps:
  1. Extract shared interface
  2. Invert one dependency
  3. Add boundary test
Risk: Medium
Effort: S
```

Never: mass rewrites, unsupervised AI refactors, or automatic PR floods.
