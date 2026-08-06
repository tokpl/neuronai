# Privacy

NeuronAI is local-first. Not "local-first by default" — local-first with nothing else available.

## What leaves your machine

Nothing.

There is no cloud service, no account, no API key, no analytics, no crash reporting and no
update check. The runtime contains no HTTP client.

This is verified rather than promised. `pnpm verify:offline` runs `init`, `scan`, `search` and
`doctor` with outbound sockets, DNS and `fetch` replaced by functions that throw
(`scripts/verify-offline.mjs`). If any code path reached for the network, those commands would
fail. You can run it yourself against a clone.

## Where your data lives

Everything is in `.neuron/` inside your own project:

| Path | Contents |
| --- | --- |
| `.neuron/brain/` | Project DNA, memories, decisions, rules — the durable brain |
| `.neuron/prefs.json` | Your init answers |
| `.neuron/runtime/` | Regenerable working store |
| `.neuron/cache/` | Scan cache |

Delete the folder and NeuronAI is gone. Nothing is written outside your project directory.

## What Neuron stores

Engineering knowledge: architecture decisions, patterns, conventions, warnings, module layout.

It does **not** store chat transcripts, source code files, credentials or personal data. Memories
are short prose written by you or proposed for your approval.

## Sharing with a team

If you commit `.neuron/brain/`, that knowledge travels through your own Git remote under your own
access controls — the same path your source code already takes. Neuron is not involved.

## Reviewing what it knows

```bash
neuron search "<anything>"   # query it
neuron brain                 # what it holds, and how each number was produced
cat .neuron/brain/knowledge.json
```

The files are plain JSON. Read them, edit them, delete lines you disagree with.

See also [SECURITY.md](../SECURITY.md).
