# README marketing assets

Visuals used by the root [`README.md`](../../README.md) to sell the **outcome** (Cursor remembers the project), not the stack.

## Current files

| File | Role |
|------|------|
| `logo.png` | Hero mark |
| `demo.png` | Terminal / CLI still (interim until GIF) |
| `demo-flow.gif` | **Primary demo loop** (placeholder until recorded) |
| `before-vs-after.png` | Side-by-side product effect |
| `cursor-workflow.png` | Cursor after init |

Architecture / knowledge-graph / retrieval PNGs are **not** featured on the marketing README path. Keep them for internal docs if useful.

## Record `demo-flow.gif` (replace placeholder)

Target storyboard (≤15s, no narration required):

1. Terminal: `neuron init` (or `npx neuronai init`)
2. Brief scan / `.neuron/` created
3. Cursor chat: *Where is authentication implemented?*
4. Answer that cites real project paths in ~2 seconds of screen time

Suggested tools: [ScreenToGif](https://www.screentogif.com/), OBS → ffmpeg, or CapCut export as GIF.

Constraints:

- Dark or light IDE is fine; keep text readable at GitHub width (~720–900px)
- No secrets, no private customer data
- Prefer a public demo repo or anonymized paths

## Optional follow-ups

- `before-after-chat.gif` — animated version of the Create auth Before/After conversation
- Compress large PNGs if GitHub clone size becomes an issue
