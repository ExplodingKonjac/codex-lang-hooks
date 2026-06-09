---
sources:
  - "README.md"
  - "scripts/*.py"
  - "plugins/**/*.json"
  - "plugins/**/*.mjs"
---

# API Reference

## Network API

N/A — this repository does not define a network API, HTTP server, route handlers, OpenAPI schema, authentication layer, rate limits, or pagination behavior.

## Local Interfaces

| Interface | Input | Output | Description |
|-----------|-------|--------|-------------|
| Codex hook command | Hook JSON on stdin | Hook decision JSON on stdout | `post_edit_hook.mjs` and `stop_hook.mjs` implement Codex hook behavior. |
| Plugin generator CLI | Plugin name and optional `--non-interactive` | New plugin directory and marketplace update | `scripts/create_language_hook_plugin.py` scaffolds language plugins. |

## Request / Response Shapes

Hook scripts consume Codex-provided hook input objects. They emit compact JSON objects such as:

```json
{
  "continue": true
}
```

or blocking decisions when a required tool fails:

```json
{
  "decision": "block",
  "reason": "ctest failed: <DETAILS>"
}
```

## Rate Limiting

N/A — no network API is exposed.

## Pagination

N/A — no collection API is exposed.
