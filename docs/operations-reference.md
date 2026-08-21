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
| GET | `/api/v1/alerts` | `alerts.list` | `limit:int` 1..100 (default 50), `scenario:string` exact, `ip:string` exact, `since:string` ISO-8601 or `N[smhd]` optional (32-char cap), `until:string` same optional, `scenario_contains:string` 1..64 substring case-insensitive optional, `offset:int` 0..10000 (default 0); allowlist `{limit,scenario,ip,since,until,scenario_contains,offset}` — strict unknown/duplicate →400 `invalid_parameters` without spawn; `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8` | `Alert[]` flattened (still `Alert[]`); filtered AND (exact `scenario` + exact `ip` + `scenario_contains` substring + `since`/`until` `created_at`) then `offset`-sliced (`alerts[offset:offset+limit]`) |
| GET | `/api/v1/alerts/inspect/{alert_id}` | `alerts.inspect` | path `alert_id` | flattened alert + events |
| GET | `/api/v1/decisions` | `decisions.list` | `limit:int` 1..100 (default 50), `type:string` alias for `decision_type` exact, `ip:string` exact, `since:string` ISO-8601 or `N[smhd]` optional, `until:string` same optional, `scenario_contains:string` 1..64 case-insensitive optional, `offset:int` 0..10000 (default 0); allowlist `{limit,type,ip,since,until,scenario_contains,offset}` — strict unknown/duplicate →400 `invalid_parameters` without spawn; `Cache-Control: no-store` | `Decision[]` flattened (still `Decision[]`); filtered AND then `offset`-sliced (`decisions[offset:offset+limit]`) |
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

### Alerts and Decisions list — filtering, validation, and cscli mapping

- **Allowlisted query keys (strict):**
  - `GET /api/v1/alerts`: `{limit, scenario, ip, since, until, scenario_contains, offset}`.
  - `GET /api/v1/decisions`: `{limit, type, ip, since, until, scenario_contains, offset}` where `type` is an alias for `decision_type` (query key is `type`; backend binds via `alias="type"`).
  - Any **unknown key** (e.g. `?foo=1`, `?type` on alerts, `?scenario` on decisions) or **duplicate key** (e.g. `?since=2026-01-01&since=2026-01-02` or `?limit=10&limit=20`) → `400 {"error":{"code":"invalid_parameters","message":"The request parameters are invalid."}}` **without spawning `cscli`** (validated via `request.query_params` + raw `query_string` before the capability/probe gate).
- **Field validation (all →400 `invalid_parameters` without spawn):**
  - `limit:int` 1..100 (default 50), `offset:int` 0..10000 (default 0).
  - `scenario_contains:string` 1..64 chars when present (empty string treated as absent); rejects `\r`, `\n`, `\0`, or any control char (`ord < 32`).
  - `since`/`until:string` 32-char cap, **strict** `ISO-8601` (`datetime.fromisoformat(v.replace("Z","+00:00"))`) **or** Go duration `N[smhd]` (`^[0-9]+[smhd]$`); rejects shell metachars `; & | \` ` `$`, `\n`, `\r`, `\0`, and leading `-`.
  - `since` after `until` →400 (only when both parse as ISO-8601 datetimes; duration bounds are pass-through only and skip server-side ordering check).
  - `scenario` (exact) and `scenario_contains` (case-insensitive substring) may **coexist** — filtered with AND. `since`/`until` filter on `created_at` (ISO-8601).
- **Filtering and pagination:** results are filtered with AND (exact `scenario`/`type`/`ip` + `scenario_contains` substring + `since`/`until` on `created_at`) then **offset-sliced** as `items[offset:offset+limit]`. Frontend resets `offset` to 0 on any filter change; `FiltersBar` `datetime-local` values are converted to ISO-8601 `Z` via `new Date(v).toISOString()` before being sent as `since`/`until`. Duration form `N[smhd]` is accepted by the API but not produced by the SPA.
- **cscli argv mapping (per plan §5.3; `CscliRunner.run(argv, timeout=CscliRunner.default_timeout)`):**
  - `GET /alerts` base `["alerts","list","-m","-l",str(limit_for_cscli),"-o","json"]` plus optional `["--since",since]` / `["--until",until]` when `CSCLI_SUPPORTS_SINCE_UNTIL` is true (A1). `limit_for_cscli = min(100, limit+offset)` when `offset>0` else `limit`. `scenario_contains` and `offset` **never enter argv** (server-side only: substring match via `_matches_scenario_contains`, pagination via slice).
  - `GET /decisions` base `["decisions","list","-l",str(limit_for_cscli),"-o","json"]` plus optional `["-t",type]` / `["-i",ip]` plus same optional `["--since",since]` / `["--until",until]` when supported. Same `limit_for_cscli` rule; `scenario_contains`/`offset` never in argv.
  - Pass-through vs fallback: when `CSCLI_SUPPORTS_SINCE_UNTIL` is true (current host), `since`/`until` are passed to cscli and server-side `created_at` fallback is skipped; when false, `since`/`until` are applied server-side against `created_at` (ISO-8601 bounds only; duration bounds yield no server-side filter).
- **Headers and safety:** success sends `Cache-Control: no-store` and `Content-Type: application/json; charset=utf-8`; raw `cscli` stderr is **never returned** (WARN-truncated to 500 chars server-side).
- **Success envelopes (HTTP 200):**
  ```json
  { "operation": "alerts.list", "result": [{ "id": 1, "scenario": "crowdsecurity/ssh-bf", "source_ip": "1.2.3.4", "created_at": "2026-08-19T12:00:00Z" }] }
  ```
  ```json
  { "operation": "decisions.list", "result": [{ "id": 1, "scenario": "crowdsecurity/ssh-bf", "source_ip": "1.2.3.4", "type": "ban", "created_at": "2026-08-19T12:00:00Z" }] }
  ```
  Filtered AND then offset-sliced; empty result is `[]` with 200.
- **Request-level errors (HTTP 400 — no spawn):**
  Unknown key:
  ```json
  { "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
  ```
  `GET /api/v1/alerts?foo=bar` →400. Duplicate key `GET /api/v1/decisions?since=2026-01-01T00:00:00Z&since=2026-01-02T00:00:00Z` →400. Invalid `since`:
  ```json
  { "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
  ```
  `GET /api/v1/alerts?since=not-a-date` →400 (fails ISO-8601 and `N[smhd]`). `since` after `until` (both ISO-8601) →400. Operation-level errors for these routes remain `unsupported`/`timeout`/`unavailable`/`permission_denied`/`crowdsec_failure`/`malformed_output` via capability gate and `classify_failure`.

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
  WITHOUT `-o json`; `matched` is `true` when the lowercased stdout contains
  the `"allowlisted"` phrasing but NOT `"not allowlisted"` (cscli prints
  `"… is allowlisted by item …"` for a hit vs `"… is not allowlisted"` for a
  miss; the literal `"found"` never appears).
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