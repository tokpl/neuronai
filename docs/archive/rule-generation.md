# Rule generation

## Sources

1. **Memory** — architecture decisions, patterns, mistakes, business rules  
2. **Code patterns** — repeated module/file naming (`PatternMiner`)  
3. **Architecture decisions** — decision text distilled into rule language  
4. **Developer corrections** — explicit mistake records  
5. **Git history** — hook point via commit counts for periodic review (full blame mining later)

## Example

Detected: 10+ API modules sharing Service + Repository naming.

Neuron suggests (status=`suggested`, severity≤WARNING):

> All API modules should use Service + Repository pattern.

Developer runs:

```bash
neuron constitution accept <id>
neuron constitution cursor-rules
```

Cursor receives `.cursor/rules/project-architecture.mdc`.

## Safety

Generators **never** emit active CRITICAL rules. Escalation to CRITICAL is a human action.
