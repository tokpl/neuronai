# /neuron-context

Load project-aware context before exploring the repository.

1. Call `neuron_context` with the user's request
2. Prefer the recommended start path, modules, files and rules it returns
3. Open those files; do not list the whole tree first
4. If context is empty, say so and only then search the repo
5. Ask one clarifying question if the change looks risky

Use `mode: "deep"` for architecture work; the default is deliberately small.
