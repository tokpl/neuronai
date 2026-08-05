# FAQ

## Does Neuron send my code anywhere?

**No by default.** Neuron is local-first. Memories live under `.neuron/` on your machine (or your self-hosted Postgres). Telemetry and remote error reporting stay **off** unless you explicitly opt in.

Optional AI provider keys (e.g. embeddings) only call services **you** configure.

## How is this different from ChatGPT memory?

ChatGPT memory is about *you* as a person across chats. Neuron is about the **codebase**: architecture decisions, patterns, warnings, and module structure for coding agents in Cursor.

## Does it work offline?

**Yes** for the default local JSON store and MCP over stdio. You do not need an account or cloud Neuron service for v0.1.

## Why MCP?

Model Context Protocol is how Cursor (and other hosts) expose tools to agents in a standard way. Neuron ships as an MCP server so the agent can call `neuron_prepare_task`, `neuron_search_memory`, etc., instead of pasting docs by hand.

## What is Neuron AI Memory?

Long-term **engineering knowledge** memory for AI coding agents — not chat transcript storage.

## Why not just RAG over the repo?

Repo RAG finds code. Neuron remembers **why** decisions were made and what to avoid — across sessions.

## MIT or Apache 2.0?

**Apache-2.0** — patent grant + clear contribution terms. See [LICENSE](../LICENSE).

## Is this v1.0?

No — **v0.1.0** public local beta. See [CHANGELOG.md](../CHANGELOG.md) for what works vs experimental.

## Which agents are supported first?

**Cursor** is the primary DX in 0.1. Other MCP hosts can call the same tools; polished adapters come later.
