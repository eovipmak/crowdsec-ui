# CrowdSec Dashboard — Architecture

## Goal

The CrowdSec Dashboard ships a **FastAPI backend** and a **Vite-built SPA**
(frontend) served together on a **single port (8090)**. The backend exposes
read-only, JSON API endpoints under `/api/v1/*` and serves the static SPA at
`/`. There is **no application database** and **no shell** execution.

## Pieces (one port)

Two pieces run as one process (uvicorn serving `backend/main.py:app`):

- **FastAPI backend** — read-only API under `/api/v1/*`, enveloped JSON,
  `cscli` subprocess execution.
- **Vite SPA frontend** — static assets in `frontend/dist/`, served by the
  backend's static catch-all handler (task-08).

```mermaid
flowchart LR
  Browser[Browser] -->|HTTP :8090| FastAPI[FastAPI app]
  FastAPI -->|/api/v1/*| Routers[Read/Status/Capabilities routers]
  FastAPI -->|/| Static[Static SPA handler]
  Routers -->|asyncio.create_subprocess_exec<br/>positional argv, no shell| Cscli[cscli]
  Cscli -->|LAPI/DB| CrowdSec[CrowdSec]
  Routers -->|app.state.runner| Cscli
```

## cscli execution model

- Commands are run via **asyncio subprocess execution**
  (`asyncio.create_subprocess_exec`).
- Arguments are passed **positionally**; **no shell** is involved.
- The executable path comes from the **config** (`cscli.executable_path`) or,
  when unset/absent, from the bootstrap fallback list:
  [`/usr/bin/cscli`, `/usr/local/bin/cscli`, `/opt/crowdsec/bin/cscli`].
- Every command has a **per-command timeout** (1s..120s, from
  `cscli.timeout`). A timeout yields the operation-level `timeout` error.
- **Capability probes are cached at startup** in `app.state.capabilities`
  (4 probes, each 5 s; if `cscli` cannot be resolved or fails to run,
  all ops report `unsupported`):
  - Probe #1 — `["alerts", "list", "-o", "json", "-l", "1"]` → 11 structured reads (`alerts.list`, `alerts.inspect`, `decisions.list`, `decisions.check`, `machines.list`, `machines.inspect`, `bouncers.list`, `bouncers.inspect`, `allowlists.list`, `allowlists.inspect`, `allowlists.check`)
  - Probe #2 — `["lapi", "status"]` → `status.lapi`
  - Probe #3 — `["capi", "status"]` → `status.capi`
  - Probe #4 — `["metrics", "show", "acquisition", "-o", "json"]` → `metrics.show` (governed by `cscli.timeout` via `CscliRunner.default_timeout`; 5 s probe timeout)

## Config schema

The config is **slim**: only three top-level keys — `server`, `cscli`,
`logging`. The `Config` model uses Pydantic v2 with `extra="ignore"`, so
**legacy `auth` / `session` top-level blocks are silently ignored**. Operators
with an older YAML that still contains them need not panic; they are inert.

```yaml
server:
  bind: 127.0.0.1
  port: 8090
  static_dir: ../frontend/dist
cscli:
  executable_path: /usr/bin/cscli   # optional
  timeout: 30s
logging:
  level: info
  format: text
  output: stderr
```

## Validation rules

The following exact `ValueError` messages come from `backend/config.py`:

- `server.bind` must not be `0.0.0.0` →
  `server.bind 0.0.0.0 is not allowed; bind to loopback or a NIC IP`
- `server.port` must not be `8080` (reserved for CrowdSec LAPI) →
  `server.port 8080 is reserved for CrowdSec LAPI`
- `cscli.timeout` must match `^\d+s$` (e.g. `'30s'`) →
  `cscli.timeout must match ^\d+s$ (e.g. '30s')`
- `cscli.timeout` must be between 1s and 120s →
  `cscli.timeout must be between 1s and 120s`
- `logging.level` must be one of `debug|info|warn|error`
- `logging.format` must be one of `text|json`

## Response envelopes — operations and routes

Fourteen operations plus health are wired (operation labels are the single
source of truth in `backend/envelope.py`):

- `capabilities.list`, `alerts.list`, `alerts.inspect`, `decisions.list`,
  `decisions.check`, `machines.list`, `machines.inspect`, `bouncers.list`,
  `bouncers.inspect`, `allowlists.list`, `allowlists.inspect`,
  `allowlists.check`, `status.lapi`, `status.capi`, `metrics.show` — the last
  added in `2026-08-16_metrics-endpoint` (`METRICS_SHOW == "metrics.show"`).
  Health (`GET /api/v1/health` → `{"status":"ok"}`) is raw, outside the
  envelope. The 14 probed operations reported by `GET /api/v1/capabilities`
  are the 11 structured reads + `status.lapi` + `status.capi` + `metrics.show`
  (Probe #4); `capabilities.list` itself is the meta-operation that reports
  them.

| Method | Path | Operation | Notes |
|---|---|---|---|
| GET | `/api/v1/health` | (none — raw) | `{"status":"ok"}`, no envelope |
| GET | `/api/v1/capabilities` | `capabilities.list` | `dict[op, {"supported": bool}]` (14 probed ops) |
| GET | `/api/v1/alerts` | `alerts.list` | list of flattened alerts |
| GET | `/api/v1/alerts/inspect/{alert_id}` | `alerts.inspect` | flattened alert + events |
| GET | `/api/v1/decisions` | `decisions.list` | list of flattened decisions |
| GET | `/api/v1/decisions/check/{ip}` | `decisions.check` | list of flattened decisions for ip |
| GET | `/api/v1/machines` | `machines.list` | list of machines |
| GET | `/api/v1/machines/inspect/{machine_id}` | `machines.inspect` | machine detail |
| GET | `/api/v1/bouncers` | `bouncers.list` | list of bouncers |
| GET | `/api/v1/bouncers/inspect/{name}` | `bouncers.inspect` | bouncer detail |
| GET | `/api/v1/allowlists` | `allowlists.list` | list of `{name, description, created_at, updated_at, size}` |
| GET | `/api/v1/allowlists/inspect/{name}` | `allowlists.inspect` | allowlist entries |
| GET | `/api/v1/allowlists/check/{ip}` | `allowlists.check` | `{"matched": bool}` |
| GET | `/api/v1/status/lapi` | `status.lapi` | `{"healthy": bool}` |
| GET | `/api/v1/status/capi` | `status.capi` | `{"enabled": bool}` |
| GET | `/api/v1/metrics` | `metrics.show` | `Record<string, unknown>` — parsed `cscli metrics show -o json` (keys are metric types), `Cache-Control: no-store` |
| GET | `/api/v1/metrics/{component}` | `metrics.show` | filtered — `component` ∈ 14 canonical types (see operations-reference), case-sensitive exact |
| — | `frontend/src/pages/Metrics.tsx` | — | SPA route `/metrics` inside `Layout` (`frontend/src/App.tsx`), selector All + 14 types |

All API responses except `/api/v1/health` use one of the three operation
envelopes (no `source.command`, no `page` fields):

- **success** — `{"operation": <op>, "result": <data>}` — HTTP 200
- **operation_error** — `{"operation": <op>, "error": {"code": <code>,
  "message": <safe_msg>}}` — HTTP 200
- **request_error** — `{"error": {"code": <code>, "message": <safe_msg>}}`
  — HTTP 4xx/5xx
- **health** — `{"status": "ok"}` — raw, **outside** the operation envelope —
  HTTP 200

Ten error codes exist:

- **Request-level** (HTTP 4xx/5xx): `invalid_parameters`, `not_found`,
  `method_not_allowed`, `internal`.
- **Operation-level** (HTTP 200): `crowdsec_failure`, `timeout`,
  `unavailable`, `permission_denied`, `malformed_output`, `unsupported`.

## Static serving rules

Per plan §6, the static catch-all handler (task-08) enforces:

- **GET/HEAD only**; other methods return the 405 envelope.
- **Exact match** on the on-disk file first.
- **`.html` fallback** (e.g. `/about` → `about.html`).
- **SPA fallback** returns **200 `index.html`** (React Router owns client
  routes) — **not** a 404.
- **`/api/*` never falls through** to static; API paths are not served by the
  static handler.
- **`no-store`** for `index.html` / the SPA fallback.
- **`public, max-age=31536000, immutable`** for `assets/*`.

## Out of scope (dropped — plan §11)

The following are **explicitly dropped** per plan §11 and are NOT part of this
release:

- **auth / session** — login, session management, and admin
  password hashing are deferred.
- **mutations** — no write/state-changing operations.
- **`/metrics/{component}`** endpoint — revived in 2026-08-16_metrics-endpoint (now `GET /api/v1/metrics` + `GET /api/v1/metrics/{component}` via `metrics.show`).
- **command-matrix** documentation.
- **pytest / automated test suite** (the build script does not run tests).
- **Go** rewrite of the backend.

If you are looking for any of these, they are intentionally absent from the
current scope.