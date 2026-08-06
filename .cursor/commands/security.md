# /security

Security review with Neuron context.

1. Call `neuron_context` with the surface under review (auth, admin, payments, …)
2. Prefer returned modules, rules and warnings
3. Never echo secrets; never store credentials in memory
4. Report findings with file paths and severity
