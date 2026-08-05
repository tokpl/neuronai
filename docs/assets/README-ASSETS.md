# README landing assets

Graphic-first marketing visuals for the root README (product landing page).

## Design tokens

| Token | Value |
|-------|-------|
| bg | `#FAFAF9` |
| surface | `#FFFFFF` |
| ink | `#111111` |
| muted | `#6B7280` |
| line | `#E5E5E5` |
| accent | `#0F766E` |
| danger | `#9A3412` |

Rules: basic SVG only (no scripts / foreignObject). Regenerate with:

```bash
node scripts/generate-landing-svgs.mjs
```

## Landing SVG set (required)

| File | Section |
|------|---------|
| `hero.svg` | Hero |
| `problem.svg` | The problem |
| `solution.svg` | NeuronAI remembers |
| `before-after.svg` | Before vs After |
| `demo.svg` | Demo storyboard |
| `cards.svg` | Why NeuronAI |
| `workflow.svg` | How it works |
| `folder-structure.svg` | `.neuron/` |
| `cursor-chat.svg` | Real example |
| `quickstart.svg` | Quick Start steps |
| `terminal.svg` | Install terminal mock |
| `architecture.svg` | Architecture |
| `roadmap.svg` | Roadmap |

## GIF

- `demo-flow.gif` — drop a real screen recording here; `demo.svg` is the storyboard until then.

## Legacy PNG

Older PNG banners/diagrams may remain in this folder but are **not** used on the landing README path.
