# Architecture drift

Neuron compares code edits against known conventions.

## Example

**Rule:** All business logic belongs in services  

**Observed:** `OrderController` calls `prisma.order.create(...)`  

**Result:** `Architecture violation detected` → pending suggestion (memory / Cursor rule) with `requiresApproval: true`.

Neuron **never** auto-rewrites controllers or auto-writes `.cursor/rules`.
