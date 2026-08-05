# GitHub Actions / billing

CI failures that finish in ~3s with annotation:

> The job was not started because your account is locked due to a billing issue.

are **not** caused by NeuronAI code. Unlock billing first:

1. Open https://github.com/settings/billing
2. Fix payment method / outstanding invoice / spending limit
3. Re-run failed workflows on https://github.com/tokpl/neuronai/actions

Public repos still need an unlocked account for Actions to schedule runners.

Workflows use `packageManager` from root `package.json` (do not set `version` on `pnpm/action-setup`).
