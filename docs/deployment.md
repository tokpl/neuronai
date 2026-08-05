# Deployment modes

| Mode | Intent |
|------|--------|
| `LOCAL` | Developer machine; file/SQLite; auth optional |
| `SELF_HOSTED` | Org-run instance; remote DB + auth hooks |
| `ENTERPRISE` | Hardened policies + audit retention |

All modes set `publicServer: false` in this foundation — **no public Neuron SaaS**.

## EnvironmentConfig

Reads `.env` / process env / config files:

- `NEURON_DEPLOYMENT_MODE`
- `NEURON_STORAGE_BACKEND`
- `DATABASE_URL`
- `NEURON_AUTH_MODE` (`none` \| `local` \| `oidc_future`)
- `NEURON_DATA_ROOT`
- `NEURON_WORKSPACE_ID` / `NEURON_PROJECT_ID`

## Self-host foundation

Prepared: config, environment, storage, authentication **hooks**.

Not included: public HTTP account server, marketplace, subscriptions.
