# MCP API versioning

Public MCP capability surface is versioned as:

```text
neuron/v1
```

Returned by `neuron_health` as `apiVersion`.

## Compatibility rules

- Additive tools/resources within `v1` are non-breaking
- Renames/removals require `neuron/v2` and a migration note
- Clients should ignore unknown fields

## Future migrations

1. Advertise both `v1` and `v2` tools during transition
2. Document mapping in `CHANGELOG.md`
3. Remove `v1` only after a deprecation window

Package semver (`0.1.0` → `1.0.0`) follows product stability; MCP `neuron/vN` follows wire compatibility.
