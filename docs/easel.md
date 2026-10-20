# Easel design state in the brain

[Easel](https://github.com/tokpl/easel) is a design-engineering toolkit for Cursor and Codex. It keeps the design of an interface (the approved direction, the motion plan, the screens, the user journeys, the verification notes) in `.easel/` and enforces its quality with gates. Neuron keeps what a project is. When a project has both, the scanner reads the Easel state so `neuron_context` can answer design questions in **every** chat, also one that never ran Easel.

## What the scan adds

When `.easel/` exists, `neuron scan` / `neuron init` read a fixed set of JSON files and add memories (source `Easel design state`, tags `easel`, `design`):

| Memory | From | Type |
|---|---|---|
| Design direction (identity, typography, colour, composition, signature details, what was rejected) | active task `direction` | `architecture_decision` |
| Motion plan (intensity, planned scenes) | active task `direction.motionPlan` | `pattern` |
| Screens of the interface | `.easel/screens.json` | `knowledge` |
| User journeys that must keep working | `.easel/journey.json` | `pattern` |
| Easel library items in use | `easel-items.json` | `dependency` |
| Open items that need the owner | `verification.json` weaknesses with `needs: "user"` | `knowledge` |

It also adds one suggested rule (follow the stored direction and library; do not restyle or re-make components by hand) and a **Design system (Easel)** section to `.neuron/project-report.md`.

## What it never reads

`.easel/auth/` (a live sign-in session) and `.easel/artifacts/` (screenshots, captures). The file walk already skips dot-directories; the analyzer reads only the named JSON files. A test plants a secret in both folders and checks it appears nowhere in the memories or the report.

## Keeping it fresh

Run `neuron scan --mode update` after the direction changes or a `finalize` finishes (Easel's `/easel-work` skill also proposes the same memories through `neuron_remember`, see Easel's `docs/neuron.md`). Memories are regenerated from the files, so there is nothing to maintain by hand.
