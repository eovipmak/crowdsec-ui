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
| GET | `/api/v1/capabilities` | `capabilities.list` | — | `dict[op, {"supported": bool}]` (16 probed ops: 11 structured reads + `status.lapi` + `status.capi` + `metrics.show` + `hub.list` + `simulation.status`; Probe #4 `["metrics","show","acquisition","-o","json"]` 5 s; Probe #5 `["hub","list","-o","json"]` 5 s; Probe #6 `["simulation","status"]` 5 s text check) |
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
| GET | `/api/v1/hub` | `hub.list` | — (any query key → 400 `invalid_parameters`; duplicate query key → 400) | `Record<string, HubItem[]>` — parsed `cscli hub list -o json` map with collections, parsers, scenarios, postoverflows, etc.; `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8` |
| GET | `/api/v1/simulation` | `simulation.status` | — (any query key → 400 `invalid_parameters`; duplicate query key → 400) | `{"global": bool, "scenarios": string[], "raw": string}` — parsed `cscli simulation status` text (global vs per-scenario; `raw` truncated to 4096 chars); `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8` |

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

### Hub inventory

- **Query validation:** `GET /api/v1/hub` accepts **no query parameters**. Any
  query key (e.g. `?foo=1`, `?type=collections`) or duplicate query key
  (e.g. `?a=1&a=2`) → `400 {error:{code:"invalid_parameters"}}` **without
  spawning `cscli`**. Validated via `request.query_params` before the
  capability gate and before the subprocess call.
- **`cscli` argv:** `["hub", "list", "-o", "json"]` via
  `CscliRunner.run(argv, timeout=CscliRunner.default_timeout)` where
  `default_timeout` is parsed from `cscli.timeout` (1 s..120 s). The startup
  probe (Probe #5) uses a fixed 5 s timeout.
- **Success envelope** (`Cache-Control: no-store`,
  `Content-Type: application/json; charset=utf-8`):
  ```json
  { "operation": "hub.list", "result": { "collections": [{"name":"crowdsecurity/base-http-scenarios","version":"0.9.1","latest_version":"0.9.2","status":"update-available","description":"HTTP base scenarios"}], "parsers": [], "scenarios": [], "postoverflows": [] } }
  ```
  `result` is the parsed `cscli hub list -o json` object — a
  `Record<string, HubItem[]>` keyed by hub type (`collections`, `parsers`,
  `scenarios`, `postoverflows`, etc.); each `HubItem` has at least
  `name: string` and optional `description`, `version`, `latest_version`,
  `status`, `tainted`, `missing`, `type`. Empty `cscli` stdout yields `{}`.
  SPA page: `frontend/src/pages/Hub.tsx` at route `/hub` (via
  `frontend/src/App.tsx` + `Layout`), per-type tables with version and status
  badges (`tainted`/`missing`/`update-available`).
- **Operation-level errors** (HTTP 200, `{"operation":"hub.list","error":{code,…}}`,
  no `stderr` leaked — `stderr` is WARN-truncated to 500 chars):
  `unsupported` (capability gate — `app.state.capabilities["hub.list"].supported
  is False`, no subprocess), `timeout` (deadline exceeded),
  `unavailable` (`executable_path is None` / spawn failure),
  `crowdsec_failure` (non-zero exit), `permission_denied` (`EACCES`),
  `malformed_output` (stdout is not valid JSON) — all via `classify_failure`
  / `envelope.operation_error`.
- **Request-level error** (HTTP 400 — query rejected):
  ```json
  { "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
  ```

### Simulation status

- **Query validation:** `GET /api/v1/simulation` accepts **no query parameters**. Any
  query key (e.g. `?foo=1`, `?type=global`) or duplicate query key
  (e.g. `?a=1&a=2`) → `400 {error:{code:"invalid_parameters"}}` **without
  spawning `cscli`**. Validated via `request.query_params` before the
  capability gate and before the subprocess call.
- **`cscli` argv:** `["simulation", "status"]` via
  `CscliRunner.run(argv, timeout=CscliRunner.default_timeout)` where
  `default_timeout` is parsed from `cscli.timeout` (1 s..120 s). The startup
  probe (Probe #6) uses a fixed 5 s timeout and is considered supported only
  when `exit_code == 0`, no `deadline_exceeded`/`exec_missing`, and stdout
  contains `"simulation"` (case-insensitive, text check).
- **Text parse (no `-o json`):** `cscli simulation status` is text-only.
  `global` is `true` when lowercased stdout contains
  `"global simulation: enabled"` or `"simulation is enabled"` or
  (`"global:"` + `"enabled"` + `"simulation"`); otherwise `false`.
  `scenarios` are lines after the `"simulation enabled for"` marker
  (fallback: lines after the global line) that contain `"/"`, stripped of
  leading `- ` / `* ` / `• `, contain no spaces/tabs, and match
  `^[a-z0-9/_.-]+$` (case-insensitive); deduplicated via `seen` set. `raw` is
  stdout truncated to 4096 chars; empty stdout → `{global:false, scenarios:[],
  raw:""}`. `raw` is always present for fallback/debug.
- **Success envelope** (`Cache-Control: no-store`,
  `Content-Type: application/json; charset=utf-8`):
  ```json
  { "operation": "simulation.status", "result": { "global": false, "scenarios": [], "raw": "global simulation: disabled\nsimulation enabled for scenarios:\n" } }
  ```
  Global enabled:
  ```json
  { "operation": "simulation.status", "result": { "global": true, "scenarios": ["crowdsecurity/ssh-bf"], "raw": "global simulation: enabled\nsimulation enabled for scenarios:\n - crowdsecurity/ssh-bf" } }
  ```
  `result` is `{"global": bool, "scenarios": string[], "raw": string}`.
  SPA surface: `frontend/src/pages/Overview.tsx` at route `/overview` (amber
  banner when `global===true` or `scenarios.length>0`, with scenario count/list
  and link to `/decisions`); `frontend/src/pages/Decisions.tsx` at route
  `/decisions` (amber callout "Decisions are suppressed" with scenario list).
  No new `/simulation` SPA route — banner-only. When simulation is OFF, banners
  are hidden (no muted badge).
- **Operation-level errors** (HTTP 200, `{"operation":"simulation.status","error":{code,…}}`,
  no `stderr` leaked — `stderr` is WARN-truncated to 500 chars):
  `unsupported` (capability gate — `app.state.capabilities["simulation.status"].supported
  is False`, no subprocess):
  ```json
  { "operation": "simulation.status", "error": { "code": "unsupported", "message": "This operation is not supported." } }
  ```
  Other operation-level codes for `simulation.status`: `crowdsec_failure` (non-zero exit):
  ```json
  { "operation": "simulation.status", "error": { "code": "crowdsec_failure", "message": "The CrowdSec command failed." } }
  ```
  `timeout` (deadline exceeded):
  ```json
  { "operation": "simulation.status", "error": { "code": "timeout", "message": "The CrowdSec command timed out." } }
  ```
  `unavailable` (`executable_path is None` / spawn failure), `permission_denied` (`EACCES`) — all via `classify_failure` / `envelope.operation_error`. Degraded: if Probe #6 failed (cscli missing / text check failed), `GET /api/v1/simulation` returns `unsupported` without spawning.
- **Request-level error** (HTTP 400 — query rejected or duplicate query key):
  ```json
  { "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
  ```
- **Read-only:** `simulation enable` / `simulation disable` (writes) are **not proxied** — read-only `status` only. Mutations remain out of scope per plan §11.

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