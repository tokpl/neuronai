# /security

Security review mode.

1. Call `neuron_run_mode` with `modeId: "security_review"`
2. Call `neuron_mode_context` - needs files, dependencies, security rules
3. Use `neuron_security_check` / `neuron_security_scan` (never echo secrets)
4. Output Threats, Severity, Recommendations
