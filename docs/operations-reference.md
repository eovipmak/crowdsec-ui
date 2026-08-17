# CrowdSec Dashboard — Operations Reference (API)

Cross-reference: [architecture](./architecture.md). This document is the
frontend team's API reference for the read-only endpoints under `/api/v1/*`.

## Response envelopes

- **success** — `{"operation": <op>, "result": <data>}` — HTTP 200
- **operation_error** — `{"operation": <op>, "error": {"code": <code>,
  "message": <safe_msg>}}` — HTTP 200
- **request_error** — `{"error": {"code": <code>, "message": <safe_msg>}}`
  — HTTP 4xx/5xx
- **health** — `{"status": "ok"}` — raw, **outside** the operation envelope —
  HTTP 200

## Endpoints

| Method | Path | Operation | Params | Success-result shape |
|---|---|---|---|---|
| GET | `/api/v1/health` | (none — raw) | — | `{"status":"ok"}` |
| GET | `/api/v1/capabilities` | `capabilities.list` | — | `dict[op, {"supported": bool}]` (14 probed ops: 11 structured reads + `status.lapi` + `status.capi` + `metrics.show`; Probe #4 `["metrics","show","acquisition","-o","json"]` 5 s) |
| GET | `/api/v1/alerts` | `alerts.list` | `limit:int` (50, 1..100), optional `scenario`, `ip` | list of flattened alerts |
| GET | `/api/v1/alerts/inspect/{alert_id}` | `alerts.inspect` | path `alert_id` | flattened alert + events |
| GET | `/api/v1/decisions` | `decisions.list` | `limit:int` (50, 1..100), optional `type`, `ip` | list of flattened decisions |
| GET | `/api/v1/decisions/check/{ip}` | `decisions.check` | path `ip` | list of flattened decisions for ip |
| GET | `/api/v1/machines` | `machines.list` | — | list of machines |
| GET | `/api/v1/machines/inspect/{machine_id}` | `machines.inspect` | path `machine_id` | machine detail |
| GET | `/api/v1/bouncers` | `bouncers.list` | — | list of bouncers |
| GET | `/api/v1/bouncers/inspect/{name}` | `bouncers.inspect` | path `name` | bouncer detail |
| GET | `/api/v1/allowlists` | `allowlists.list` | — | list of `{name, description, created_at, updated_at, size}` |
| GET | `/api/v1/allowlists/inspect/{name}` | `allowlists.inspect` | path `name` | allowlist entries |
| GET | `/api/v1/allowlists/check/{ip}` | `allowlists.check` | path `ip` | `{"matched": bool}` |
| GET | `/api/v1/status/lapi` | `status.lapi` | — | `{"healthy": bool}` |
| GET | `/api/v1/status/capi` | `status.capi` | — | `{"enabled": bool}` |
| GET | `/api/v1/metrics` | `metrics.show` | — (any query key → 400 `invalid_parameters`; duplicate query key → 400) | `Record<string, unknown>` — parsed `cscli metrics show -o json` object keyed by metric type; full snapshot; `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8` |
| GET | `/api/v1/metrics/{component}` | `metrics.show` | path `component` ∈ 14 canonical types (see § Metrics allowlist); any query key → 400 | `Record<string, unknown>` — filtered `{"<component>": …}`; `Cache-Control: no-store` |

### Metrics allowlist and validation

- **Allowlist (14 canonical types, case-sensitive exact; no alias):** `acquisition`, `alerts`, `appsec-engine`, `appsec-rule`, `bouncers`, `decisions`, `lapi`, `lapi-bouncer`, `lapi-decisions`, `lapi-machine`, `parsers`, `scenarios`, `stash`, `whitelists`. Aliases such as `engine`, `lapi`, `appsec` are **rejected**.
- **Invalid `component`** (e.g. `foobar`, `Acquisition`, `engine`) → `400 {error:{code:"invalid_parameters"}}` **without spawning `cscli`**.
- **Unknown or duplicate query key** on either `/metrics` endpoint → `400 {error:{code:"invalid_parameters"}}` without spawning.
- **`cscli` argv:** `GET /metrics` → `["metrics","show","-o","json"]`; `GET /metrics/{component}` → `["metrics","show",component,"-o","json"]`; timeout from `cscli.timeout` / `CscliRunner.default_timeout` (Probe #4 uses 5 s fixed).

### Envelope examples

All metrics responses use `Content-Type: application/json; charset=utf-8`. Success also sends `Cache-Control: no-store`.

Success (HTTP 200 — full snapshot):
```json
{ "operation": "metrics.show", "result": { "acquisition": { "file:/var/log/auth.log": { "reads": 7395, "parsed": 4911 } }, "alerts": {} } }
```

Success (HTTP 200 — filtered):
```json
{ "operation": "metrics.show", "result": { "acquisition": { "file:/var/log/auth.log": { "reads": 7395 } } } }
```

Operation-level error (HTTP 200 — capability-gated or `cscli` failure; no `stderr` leaked):
```json
{ "operation": "metrics.show", "error": { "code": "unsupported", "message": "This operation is not supported." } }
```
Other operation-level codes for `metrics.show`: `crowdsec_failure`, `timeout`, `unavailable`, `permission_denied`, `malformed_output` (malformed JSON stdout) — all via `classify_failure` / envelope.

Request-level error (HTTP 400 — invalid component or query):
```json
{ "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
```

### Notes

- **`GET /api/v1/metrics` is dashboard JSON**, distinct from Prometheus text exposition `GET /metrics` (not in scope per taste § lean — no Prometheus/Grafana/docs for it; CrowdSec's own `/metrics` can be scraped directly if needed).
- **`/decisions/check/{ip}`** and **`/allowlists/check/{ip}`** REQUIRE
  percent-encoding of a CIDR's `/` as `%2F` (e.g. `1.2.3.0/24` →
  `1.2.3.0%2F24`) so the path parameter resolves correctly.
- **`allowlists.check`** returns `{"matched": bool}`. `cscli` is run
  WITHOUT `-o json`; `matched` is `true` when the substring `"found"` appears
  in the lowercased stdout.
- **`status.lapi`** returns `{"healthy": bool}`. `cscli` is run WITHOUT
  `-o json`; `healthy` is `true` when the substring `"successfully interact"`
  appears in the lowercased stdout.
- **`status.capi`** returns `{"enabled": bool}`. `cscli` is run WITHOUT
  `-o json`; `enabled` is `true` when stdout is non-empty.

## Error codes

Ten error codes exist. Request-level codes map to HTTP 4xx/5xx;
operation-level codes are returned as HTTP 200 operation errors.

### Request-level (HTTP 4xx/5xx)

| Code | Default message |
|---|---|
| `invalid_parameters` | The request parameters are invalid. |
| `not_found` | The requested resource was not found. |
| `method_not_allowed` | This request method is not allowed. |
| `internal` | An unexpected server error occurred. |

### Operation-level (HTTP 200)

| Code | Default message |
|---|---|
| `crowdsec_failure` | The CrowdSec command failed. |
| `timeout` | The CrowdSec command timed out. |
| `unavailable` | The CrowdSec command is not available. |
| `permission_denied` | CrowdSec denied permission to run the command. |
| `malformed_output` | CrowdSec returned malformed output. |
| `unsupported` | This operation is not supported. |

All messages are **safe**; raw `cscli` stderr is never returned to clients.

## Authentication

There is currently **no authentication/session layer** — login and session
management are **deferred** (plan §11). These endpoints are intended to run
bound to loopback or a protected interface.