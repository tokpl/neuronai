# NeuronAI Open Source Audit

**Date:** 2026-08-06  
**Scope:** Licensing, trademark posture, community docs, OSS readiness  
**Constraint:** No product features or architecture changes in this pass

---

## 1. Current state

| Artifact | Status |
|----------|--------|
| `LICENSE` | Apache License 2.0 (full text) |
| Root + all publishable `package.json` | `"license": "Apache-2.0"` |
| README license badge | Apache 2.0 |
| `CONTRIBUTING.md` | Minimal (install + PR checklist only) |
| `CODE_OF_CONDUCT.md` | Present (Contributor Covenant 2.1, abbreviated) |
| `SECURITY.md` | Present; references missing `docs/privacy.md` |
| `NOTICE` | Missing (optional under Apache) |
| `TRADEMARK.md` | Missing (before this pass) |
| `.github/ISSUE_TEMPLATE/` | Present (`bug.yml`, `feature.yml`) |
| `.github/PULL_REQUEST_TEMPLATE.md` | Present |
| `.github/DISCUSSION_TEMPLATE/` | Present |
| `.github/FUNDING.yml` | Present (`github: [tokpl]`) |
| Issue template `config.yml` | Stale placeholders (`YOUR_ORG/neuron-ai-memory`) |

**Product intent (stated):** fully open-source local core; public development; easy PRs; brand protection; future optional Cloud/SaaS monetization without closing the local product.

---

## 2. Licensing audit (Apache-2.0)

### 2.1 Is the current license appropriate?

**Yes, for an OSS CLI + MCP library that wants wide adoption and later commercial services.**

Apache-2.0 is a permissive, OSI-approved license with:

- explicit patent grant from contributors,
- clear contribution default (inbound = Apache-2.0 unless stated otherwise),
- **trademark carve-out** (Section 6: the license does **not** grant trademark rights),
- compatibility with most corporate open-source policies.

It matches NeuronAI’s goals: public code, contributor-friendly, cloud/services as a separate commercial layer.

### 2.2 Can a competitor create a closed-source fork?

**Yes.** Under Apache-2.0, others may:

- fork the code,
- modify it,
- distribute proprietary binaries / closed products derived from it,

provided they keep required notices/LICENSE attribution (and NOTICE if present).

They **cannot** lawfully imply official NeuronAI branding without trademark permission (license ≠ trademark).

### 2.3 Can someone sell SaaS without publishing their changes?

**Yes (for Apache-2.0).** Running modified Apache-2.0 software as a network service does **not** require publishing source of modifications (unlike AGPL).

That also means **you** can offer a future NeuronAI Cloud without open-sourcing proprietary cloud glue—while keeping the local OSS core public.

### 2.4 Consequences of staying on Apache-2.0

| Upside | Downside / risk |
|--------|------------------|
| Max contributor & company adoption | Competitors can ship closed forks of the *code* |
| Easy dual path: OSS local + paid Cloud | Copycats may rebrand slightly and compete on UX |
| Patent grant reduces contributor fear | Less “copyleft leverage” against SaaS freeriders |
| Section 6 supports trademark policy | Brand must be defended via trademark docs + practice, not license alone |

---

## 3. Recommendation: keep Apache-2.0 (do not switch yet)

### Why not auto-switch to AGPL-3.0

AGPL-3.0 would force network operators of modified versions to offer corresponding source. That hurts freeriding SaaS clones, but:

| | AGPL-3.0 |
|--|----------|
| **Pros** | Stronger protection against closed hosted forks; clearer “share alike” ethos |
| **Cons** | Many companies ban AGPL; fewer enterprise contributors; harder npm/ecosystem embedding; can scare Cursor/plugin integrators |
| **Community** | Attracts copyleft-aligned developers; shrinks corporate PR pipeline |
| **Firms** | Legal review friction; “AGPL contamination” fears |
| **Monetization** | Does **not** stop you from selling Cloud, but dual-licensing AGPL + commercial is heavier ops; Apache already allows Cloud without publishing proprietary service code |

**Recommendation:** Keep **Apache-2.0** for the open core. Protect **NeuronAI** via trademark policy + distinct Cloud offering. Revisit AGPL/SSPL-style options only if a clear freerider problem appears—and only after a deliberate community migration plan.

**Do not change `LICENSE` in this pass** (await explicit maintainer decision).

---

## 4. Brand / trademark plan

1. Publish `TRADEMARK.md` (done in this pass): code is OSS; name/logo are not a free-for-all.
2. Keep Apache Section 6 as the legal backbone (no trademark grant in the software license).
3. Optional later: register “NeuronAI” as a trademark in relevant jurisdictions (not done here).
4. README short **License** + **Trademark** sections (done).
5. Logos/assets: treat brand marks as restricted; code under Apache.

---

## 5. Open Source health scorecard

| Dimension | Score (1–5) | Notes |
|-----------|-------------|--------|
| Trust | 4 | Apache + SECURITY + CoC; fix privacy doc link |
| Transparency | 4 | Public monorepo, CI, clear local-first story |
| Documentation | 3.5 | Good README; CONTRIBUTING was thin; audit/trademark added |
| Contributor experience | 3.5 | Templates exist; URLs were stale; CONTRIBUTING expanded |
| Maintainability | 4 | Turborepo, tests, conventional commits culture |

**Public OSS readiness:** **Ready with Apache-2.0 + trademark policy**, after this documentation pass. License change is **not** required to go public.

---

## 6. Risk analysis (summary)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Closed competitor fork of code | Medium | Trademark; superior product velocity; Cloud value-add |
| SaaS clone without contributing | Medium | Same; optional future license dual-track if needed |
| Brand confusion (“Official NeuronAI”) | Medium | `TRADEMARK.md` + enforcement |
| AGPL switch alienates contributors | High (if done casually) | Stay Apache unless strategy changes |
| Broken SECURITY/privacy links | Low | Fix references |

---

## 7. Changes made in this pass

- Added `TRADEMARK.md`
- Added `docs/OPEN_SOURCE_AUDIT.md` (this file)
- Expanded `CONTRIBUTING.md` (workflow, issues, PRs, commits, local run)
- Updated README **License** + **Trademark** sections
- Fixed `.github/ISSUE_TEMPLATE/config.yml` links → `tokpl/neuronai`
- Softened `.github/FUNDING.yml` to a placeholder (sponsors not configured)
- Added minimal `docs/privacy.md` so SECURITY.md link resolves
- Added `NOTICE` (Apache attribution companion)

**Not changed:** `LICENSE` text (remains Apache-2.0).

---

## 8. Suggested next steps (manual)

1. Confirm keep Apache-2.0 (recommended) **or** schedule a separate license RFC if AGPL is desired.
2. Enable GitHub Discussions + Security Advisories on `tokpl/neuronai`.
3. Consider formal trademark filing when budget/brand risk justifies it.
4. After next release, reinstall globals from npm (`neuronai@latest`) so CLI help/`build` match published artifacts.
