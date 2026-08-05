# License Migration Report — AGPL-3.0

**Date:** 2026-08-06  
**Scope:** First-party license and documentation/metadata only  
**Out of scope:** Code, APIs, architecture, features, dependency re-licensing, npm publish

---

## Summary

NeuronAI’s first-party software is now licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0), an OSI-approved open-source license. Package metadata and project docs were updated to match. No implementation files required SPDX or header changes (none were present).

## Why AGPL-3.0

- Keep the local product open source while requiring source availability when a **modified** version is offered as a network service.
- Reduce closed SaaS freeriding on the OSS core without closing the local product.
- Preserve a clear split: **code** under AGPL; **brand/logo** under [`TRADEMARK.md`](../TRADEMARK.md) (not granted by the software license).

## Changes

| Item | Change |
|------|--------|
| `LICENSE` | Replaced with official AGPL-3.0 text from gnu.org |
| `NOTICE` | Deleted (companion file from the previous permissive license; not required for AGPL) |
| Root + `apps/*` + `packages/*` `package.json` | `"license": "AGPL-3.0"` |
| `scripts/prepare-npm-packages.mjs` | Default license fallback → `AGPL-3.0` |
| `README.md`, `apps/cli/README.md` | Badge, License, Trademark sections |
| `CONTRIBUTING.md` | Inbound contributions = AGPL-3.0; **no CLA** |
| `TRADEMARK.md` | License-name references only (policy substance unchanged) |
| `docs/OPEN_SOURCE_AUDIT.md` | Marked superseded; points here |

## Consequences

| Area | Effect |
|------|--------|
| Open source status | Remains OSI Open Source |
| Network use of modifications | Typically must offer corresponding source of the modified version |
| Closed proprietary forks as a service | Harder than under a prior permissive license |
| Corporate contribution appetite | Some orgs avoid AGPL; document and accept as trade-off |
| Brand / Cloud | Trademark policy unchanged; optional Cloud may remain separate |
| Third-party deps | Unchanged; licenses in `node_modules` stay as published by those packages |

## Advantages

- Stronger copyleft for network-deployed modifications
- Clear public signal that local NeuronAI stays open under AGPL
- Aligns package registry metadata with the repository license

## Limits

- Does not by itself create or register trademarks
- Does not re-license third-party dependencies
- Does not require a CLA (contributions are accepted under AGPL-3.0)
- npm republish of packages with updated license fields is a follow-up, not part of this migration

## Previous license

First-party code and metadata previously used **Apache-2.0**. This migration replaces that designation project-wide for NeuronAI’s own packages and docs.

## Conflicts found

- **First-party source:** none (no SPDX headers in `.ts` / implementation files referring to the previous license)
- **TRADEMARK.md:** minimal license-name edits only so zero stale license strings remain; brand policy not rewritten
- **Prior audit doc:** “keep permissive license” guidance superseded by this migration
- **Third-party:** dependency licenses intentionally left alone

## Verification

Repo-wide search for `Apache` / `NOTICE` (excluding `node_modules` and `.git`) should be clean except this report’s single historical mention of the previous license name above.
