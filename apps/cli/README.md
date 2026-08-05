<p align="center">
  <img src="https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/logo.png" alt="NeuronAI" width="96" />
</p>

<h1 align="center">NeuronAI</h1>

<p align="center"><b>Give Cursor long-term memory.</b></p>

<p align="center">
  Your AI finally remembers everything about your project.
</p>

<p align="center">
  NeuronAI speeds up AI-assisted development by remembering architectural decisions, conventions, and implementation history — so you stop re-explaining the codebase in every chat.
</p>

<p align="center">
  <a href="https://github.com/tokpl/neuronai"><img alt="GitHub" src="https://img.shields.io/badge/github-tokpl%2Fneuronai-black?logo=github" /></a>
  <a href="https://github.com/tokpl/neuronai/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
  <a href="https://nodejs.org"><img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" /></a>
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-no%20cloud-informational" />
  <a href="https://www.npmjs.com/package/neuronai"><img alt="npm" src="https://img.shields.io/badge/npm-neuronai-cb3837?logo=npm" /></a>
</p>

<p align="center">
  <a href="#quick-start"><b>Install</b></a> ·
  <a href="#quick-start"><b>Quick Start</b></a> ·
  <a href="#demo"><b>Demo</b></a>
</p>

```bash
npm install -g neuronai
```

---

## The problem

Every AI coding assistant forgets.

**New chat?** It forgets.

**Tomorrow?** It forgets.

**Another computer?** It forgets.

**A month later?** It forgets.

You keep explaining the same project over and over again.

---

## Before / After

> Create auth.

<table>
<tr>
<td width="50%" valign="top">

#### Without NeuronAI

**Cursor**

> How do you authenticate users?<br/>
> Should I use NextAuth, Clerk, or a custom JWT?<br/>
> Where should middleware live?

</td>
<td width="50%" valign="top">

#### With NeuronAI

**Cursor**

> Your project already uses Clerk.<br/>
> The middleware lives in <code>middleware.ts</code>.<br/>
> Protected routes are grouped under <code>/(dashboard)</code>.<br/>
> The session helper is in <code>lib/auth.ts</code>.<br/>
> I'll follow the existing architecture.

</td>
</tr>
</table>

![Before vs After](https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/before-vs-after.png)

**Stop explaining your project to AI over and over again.**

```bash
npm install -g neuronai && cd your-project && neuron init
```

---

## Demo

<!-- When recorded, swap the still for: https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/demo-flow.gif (see docs/assets/README-ASSETS.md). -->

```text
neuron init  →  scan  →  Cursor  →  "Where is authentication implemented?"  →  answer in seconds
```

<p align="center">
  <img src="https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/demo.png" alt="NeuronAI in the terminal" width="720" />
</p>

<p align="center"><i>Animated loop placeholder: <code>docs/assets/demo-flow.gif</code> — record and drop in (storyboard in <a href="https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/README-ASSETS.md">README-ASSETS.md</a>).</i></p>

![Cursor workflow](https://raw.githubusercontent.com/tokpl/neuronai/main/docs/assets/cursor-workflow.png)

---

## NeuronAI remembers

- Architecture
- Decisions
- Business logic
- Project conventions
- TODOs
- Why something was built
- Relationships between files
- Patterns

So Cursor starts closer to a teammate who already knows the repo — not a blank chat.

---

## Why developers love NeuronAI

| | |
|---|---|
| Remembers previous decisions | Less “how do we usually do X?” |
| Less prompt engineering | Context arrives with the task |
| Faster feature development | Fewer wrong turns and rewrites |
| Works with existing projects | `neuron init` on the repo you already have |
| Local-first | Stored in your project under `.neuron/` |
| No cloud | Nothing required for NeuronAI itself |
| No API keys | Zero secrets to start |
| Share through Git | Teammates get the same memory on `git pull` |

---

## Without NeuronAI vs with NeuronAI

| Without NeuronAI | With NeuronAI |
|------------------|---------------|
| Explain the project every chat | AI remembers |
| Re-explain architecture | Remembered |
| Search manually for “how we do auth” | Instant project context |
| Heavy prompt engineering | Minimal |
| New teammate’s AI starts from zero | Already understands the project |

---

## What NeuronAI remembers

```text
Architecture
    ↓
Tech stack
    ↓
Conventions
    ↓
Patterns
    ↓
Business rules
    ↓
Dependencies
    ↓
Decisions
    ↓
Connected project knowledge
```

---

## Quick Start

**About two minutes.**

```bash
npm install -g neuronai
cd your-project
neuron init
```

Or without a global install:

```bash
npx neuronai init
```

`neuron init` will:

1. Create `.neuron/` in the project
2. Scan what it can learn from the codebase
3. Wire Cursor so NeuronAI is available as an MCP server

Then in Cursor:

1. **Settings → Tools & MCP**
2. Find **neuron** → **Enable**
3. Wait for a healthy/green status

Ask something real:

> Prepare adding a refund flow using NeuronAI

or:

> Where is authentication implemented?

---

## How it works

```text
Your project → neuron init / scan → memory in .neuron/ → Cursor uses it on the next task
```

Details for contributors live under [`docs/`](https://github.com/tokpl/neuronai/blob/main/docs/). You do not need them to get value in the first two minutes.

---

## FAQ

**Do I need Postgres, Docker, or an API key?** No.

**How does the team share memory?** Commit the versioned `.neuron/*.json` files. `git pull` is the share path.

**Is this an AI agent?** No — it is long-term project memory for Cursor.

**VS Code?** Cursor-first today.

More: [`docs/faq.md`](https://github.com/tokpl/neuronai/blob/main/docs/faq.md)

---

## Contributing

[`CONTRIBUTING.md`](https://github.com/tokpl/neuronai/blob/main/CONTRIBUTING.md) · [`CODE_OF_CONDUCT.md`](https://github.com/tokpl/neuronai/blob/main/CODE_OF_CONDUCT.md)

## Security

[`SECURITY.md`](https://github.com/tokpl/neuronai/blob/main/SECURITY.md)

## License

NeuronAI’s **source code** is licensed under the [GNU Affero General Public License v3.0](https://github.com/tokpl/neuronai/blob/main/LICENSE) (AGPL-3.0).

You may use, modify, and distribute the software under those terms. If you modify NeuronAI and provide it to others over a network, the AGPL also requires that you offer the corresponding source of your modified version. See [`LICENSE`](https://github.com/tokpl/neuronai/blob/main/LICENSE) for the full terms.

## Trademark

**NeuronAI** and **Neuron - AI Memory** identify this project. The software license does **not** grant trademark rights to the name or logo.

- Local NeuronAI remains open source under AGPL-3.0
- The brand and logo are covered by [`TRADEMARK.md`](https://github.com/tokpl/neuronai/blob/main/TRADEMARK.md)
- Future Cloud / hosted services may be offered separately; they are optional and do not replace the local OSS product

---

<p align="center">
  <a href="https://github.com/tokpl/neuronai">github.com/tokpl/neuronai</a>
</p>
