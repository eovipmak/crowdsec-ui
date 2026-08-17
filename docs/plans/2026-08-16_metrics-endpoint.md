# Plan: Metrics Endpoint — `GET /api/v1/metrics` + `GET /api/v1/metrics/{component}`

Date: 2026-08-16
Status: Draft — awaiting review
Supersedes: N/A (revives dropped scope from `2026-08-15_fastapi-rebuild.md` §11 — `/metrics/{component}`)

## 1. Goal and Non-Goals

### Goal
Add a **read-only metrics endpoint** to the CrowdSec Dashboard that proxies `cscli metrics show -o json` through the existing `CscliRunner` / envelope / capabilities pattern, with an optional per-component filter and a read-only SPA page to inspect it. Single port (8090), no DB, no shell, no new deploy topology.

### Non-Goals (explicitly out of scope)
- **Prometheus scrape endpoint** (`GET /metrics` text exposition). This feature is the dashboard JSON API (`/api/v1/metrics`), not a Prometheus target.
- **Push / mutation** — no `cscli metrics` writes (there are none).
- **History / persistence / aggregation** — metrics are live from `cscli` on every request; no storage, no rollups.
- **Grafana / Prometheus / alerting platform** — taste strongly prefers lean internal tools; excluded.
- **Auth / session** — still deferred per `docs/architecture.md`; this endpoint inherits the same loopback-bound, no-auth posture as every other `GET /api/v1/*`.
- **New config keys, new systemd units, Docker/K8s work, or separate databases.**
- **Aliases** (`engine`, `lapi`, `appsec` groups) as API inputs — canonical types only (keeps contract stable).

## 2. Current-State Findings

### What exists today
- **FastAPI backend** at `backend/` — single `uvicorn` process, `/api/v1/*` enveloped JSON, `frontend/dist/` served last via `backend/static.py`. See `docs/architecture.md` § Pieces, Envelope, Static serving rules.
- **cscli runner** — `backend/routers/cscli.py:CscliRunner` via `asyncio.create_subprocess_exec` (positional argv, no shell), `RunResult{exit_code, stdout, stderr, deadline_exceeded, exec_missing, eacces}` and `classify_failure()` mapping to operation-level codes. Timeout from `config.cscli_timeout_seconds` (1..120s, `^\d+s$`).
- **Capabilities probes** — `backend/capabilities.py:probe_capabilities()` runs 3 probes at startup, caches `app.state.capabilities: dict[op, {supported: bool}]`, `GET /api/v1/capabilities` returns the cached map without invoking `cscli` at request time.
  - Probe 1: `alerts list -o json -l 1` (covers 11 structured reads)
  - Probe 2: `lapi status` → `status.lapi`
  - Probe 3: `capi status` → `status.capi`
- **Routers** — `backend/routers/{alerts,decisions,machines,bouncers,allowlists,status,capabilities}/*` — all share the same shape: check `app.state.capabilities[op].supported` → `operation_error(UNSUPPORTED)` without invoking `cscli`; else `runner.run(argv)` → `classify_failure` on failure → `operation_error(code)`; else parse `stdout` (or substring-matched text for `status.*` / `allowlists.check`) → `success(op, result)`. Stderr is logged at WARN, never returned.
- **Envelope** — `backend/envelope.py` + `backend/errors.py` canonical labels + 10 codes (`invalid_parameters`, `not_found`, `method_not_allowed`, `internal` at 4xx/5xx; `crowdsec_failure`, `timeout`, `unavailable`, `permission_denied`, `malformed_output`, `unsupported` at 200). Frontend mirrors these in `frontend/src/lib/api/types.ts` + `frontend/src/lib/api/errors.ts` + `frontend/src/lib/api/client.ts:apiGet`.
- **Config** — `config.yaml` + `backend/config.py` reduced schema `server/cscli/logging` only, `extra="ignore"` for legacy `auth/session` blocks. No `metrics` section.
- **Frontend** — Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn/ui + React Router 7 + TanStack Query v5. 6 pages (`overview/alerts/decisions/machines/bouncers/allowlists`) + `Overview.tsx` polls LAPI/CAPI. Router in `frontend/src/router.tsx` / `frontend/src/App.tsx`.

### What `cscli metrics` actually does (verified on host, 2026-08-16)
- `cscli metrics --help`, `cscli metrics show --help`, `cscli metrics list -o json` all available (`/usr/bin/cscli` present).
- **Canonical types (14)** from `cscli metrics list -o json`: `acquisition`, `alerts`, `appsec-engine`, `appsec-rule`, `bouncers`, `decisions`, `lapi`, `lapi-bouncer`, `lapi-decisions`, `lapi-machine`, `parsers`, `scenarios`, `stash`, `whitelists`. Aliases `engine/lapi/appsec` exist but expand to groups — excluded from API.
- `cscli metrics show -o json` → single JSON object keyed by type (e.g. `{"acquisition": {"file:/var/...": {...}}, "alerts": {...}, ...}`); empty groups are `{}`. Per-type: `cscli metrics show acquisition -o json` → `{"acquisition": {...}}`. Invalid type: `cscli metrics show foobar -o json` → exit 0? **No** — exits non-zero with stderr `unknown metrics type: foobar` (verified; request should be 400, not proxied to `cscli`).
- `cscli metrics show -o json` can be large (suricata/packet counters) but bounded; no streaming needed.

### Relevant files (read)
- `docs/architecture.md`, `docs/operations-reference.md`, `docs/plans/2026-08-15_fastapi-rebuild.md`, `docs/kanban/2026-08-15_fastapi-rebuild/README.md`
- `backend/main.py`, `backend/config.py`, `backend/envelope.py`, `backend/errors.py`, `backend/capabilities.py`, `backend/static.py`
- `backend/routers/cscli.py`, `backend/routers/status.py`, `backend/routers/capabilities.py`, `backend/routers/alerts/list.py`, `backend/routers/allowlists/check.py`, `backend/routers/machines/list.py`
- `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/pages/Overview.tsx`, `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/errors.ts`, `frontend/src/hooks/useAlerts.ts`
- `config.yaml`, `deploy/config.example.yaml`, `frontend/package.json`, `deploy/crowdsec-dashboard.service`

## 3. Proposed Architecture and Data/Control Flow

### Summary
One new **capability** (`metrics.show`), one (or two) new **routes** under `/api/v1/metrics`, reusing the exact handler shape of every other read router. Frontend adds one hook + one page. No new services, no DB, no config key.

```
Browser  ── GET /api/v1/metrics[/{component}] ──► FastAPI /api/v1
                                              ├─ check app.state.capabilities["metrics.show"].supported
                                              │   └─ false → {operation:"metrics.show", error:{code:"unsupported"}} (HTTP 200, no cscli call)
                                              ├─ validate {component} against allowlist (14 types)
                                              │   └─ invalid → {error:{code:"invalid_parameters"}} (HTTP 400)
                                              ├─ CscliRunner.run(["metrics","show",[component],"-o","json"])
                                              ├─ RunResult → classify_failure on exec_missing/eacces/timeout/exit≠0
                                              │   └─ operation_error("metrics.show", code) (HTTP 200, stderr logged not returned)
                                              ├─ parse stdout as JSON; malformed → operation_error(MALFORMED_OUTPUT)
                                              └─ success("metrics.show", <parsed JSON>)  (HTTP 200, Cache-Control: no-store)

Startup:  lifespan() → load_config → resolve_cscli_path → CscliRunner → probe_capabilities()
          probe_capabilities adds Probe #4: ["metrics","show","acquisition","-o","json"] (5s).
          Success → caps["metrics.show"]={supported:true}; failure → {supported:false}.
```

### Why this shape (decisions)
| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Operation label | `metrics.show` (single label for both `GET /metrics` and `GET /metrics/{component}`) | Mirrors `cscli metrics show`; one capability key; consistent with `alerts.list`/`alerts.inspect` split but metrics has no natural list/inspect distinction. |
| D2 | Route shape | `GET /api/v1/metrics` (all) + `GET /api/v1/metrics/{component}` (filtered) | Revives prior `GET /metrics/{component}` while adding a useful "all" view; matches existing `GET /decisions/check/{ip}` path-param precedent (§3.3). Alternative `?type=` query was rejected — less RESTful and diverges from prior plan. |
| D3 | Component allowlist | Exactly the 14 types from `cscli metrics list -o json` (see §5) | Server-side validation prevents shell-adjacent surprises even though argv is positional; also gives a clean 400 instead of proxying to `cscli` and surfacing `crowdsec_failure`. Aliases (`engine` etc.) deliberately rejected — they are sugar that expands server-side and would blur the contract. |
| D4 | Probe command | `cscli metrics show acquisition -o json` (5s) | Cheapest structured probe that proves `-o json` works; `acquisition` always exists (even if empty). `cscli metrics list -o json` would also work but doesn't prove `show -o json`. Validated on host. |
| D5 | Output shape | Pass through parsed JSON object verbatim as `result` | Metrics payload is heterogeneous per-type (maps of maps, counters); normalizing would be speculative and lossy. Frontend renders generically. |
| D6 | Frontend hook shape | `useMetrics(component?: string)` via `apiGet("/metrics[/{component}]")` | Follows `useAlerts`/`useDecisions` exactly. |
| D7 | Config | No new YAML key | Keep `config.yaml` slim (`server/cscli/logging` only) per architecture; timeout and executable path reuse `cscli.*`. |

## 4. Exact Files / Directories to Create and Modify

### Backend — new
- `backend/routers/metrics/__init__.py` — package marker.
- `backend/routers/metrics/show.py` — two handlers (all + per-component) OR one handler with optional path param. Shall expose `router: APIRouter` (prefix `/metrics`, tags `["Metrics"]`). Decision to validate at implementation: prefer **one file, two routes** for clarity; alternative is two files — either satisfies the contract.

### Backend — modified
- `backend/envelope.py` — add `METRICS_SHOW = "metrics.show"` alongside existing 13 labels (now 14 ops).
- `backend/capabilities.py` — add `METRICS_SHOW = "metrics.show"` to caps dict; add Probe #4 (`["metrics","show","acquisition","-o","json"]`, 5s); include it in the `STRUCTURED_READS`-adjacent list or a new `METRICS_OPS` constant. Keep returned shape `dict[str, {supported: bool}]` — now 14 entries (existing 13 + `metrics.show`).
- `backend/main.py` — `from routers.metrics.show import router as metrics_router` and `api.include_router(metrics_router)` under the existing `APIRouter(prefix="/api/v1")` before the static mount. No other change.
- `docs/architecture.md` — add `metrics.show` to operation list, extend capabilities probe table, update route table; remove `/metrics/{component}` from "Out of scope" dropped list (or mark as revived).
- `docs/operations-reference.md` — add endpoint row(s) per §5.1; extend error-code contract if needed (no new codes).

### Frontend — new
- `frontend/src/hooks/useMetrics.ts` — `useMetrics(component?: string)` + `MetricsResult` type (generic `Record<string, unknown>` payload; optional typed helpers for `acquisition` etc. is non-blocking).
- `frontend/src/pages/Metrics.tsx` — read-only page: component selector (dropdown of 14 types + "All"), auto-refresh toggle (off by default or 30s like Overview), loading/empty/error states via existing `LoadingSkeleton`/`ErrorPanel`/`CapabilityBadge`, JSON/table rendering (lean tables per component; fallback to `<pre>` for unknown shapes).

### Frontend — modified
- `frontend/src/lib/api/types.ts` — add `METRICS_SHOW` / `metrics.show` string constant (mirror `backend/envelope.py`).
- `frontend/src/lib/api/errors.ts` — no change needed (reuses existing 10 codes), but optionally add metrics-specific fallback wording — not required.
- `frontend/src/App.tsx` — add `Metrics` route.
- `frontend/src/router.tsx` — add `metrics` entry to route table comment.
- `frontend/src/components/Layout.tsx` (or equivalent nav) — add "Metrics" nav item (icon `lucide-react:BarChart3` or similar; keep existing dark theme).
- `frontend/src/hooks/*` — no change to existing hooks.

### Docs / deploy — modified (minimal)
- `deploy/config.example.yaml` — no change (no new key). Optionally add a commented note that metrics respects `cscli.timeout`.

### Explicitly not created
- `backend/tests/`, `backend/metrics.py` at top-level, new Prometheus exporters, Grafana dashboards, `docs/command-matrix.md`, DB migrations, auth/session files.

## 5. Interfaces, Schemas, Routes, Commands, Configuration Contracts

### 5.1 HTTP interface (wire contract — extends `docs/architecture.md` §3.3 + `docs/operations-reference.md`)

All responses: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` (same as every other `/api/v1/*`).

| Method | Path | Operation | Params | Success `result` shape | Notes |
|--------|------|-----------|--------|------------------------|-------|
| GET | `/api/v1/metrics` | `metrics.show` | — | `Record<string, unknown>` — the parsed `cscli metrics show -o json` object (keys are metric types). | Full snapshot. |
| GET | `/api/v1/metrics/{component}` | `metrics.show` | `component` path param — one of 14 canonical types (see §5.2) | `Record<string, unknown>` — e.g. `{"acquisition": {...}}` for `acquisition` | Filtered snapshot. |
| GET | `/api/v1/capabilities` | `capabilities.list` | — | Now 14 entries (was 13) | Probe cache, unchanged behavior. |

**Validation rules (new):**
- Unknown query key on `/metrics` → `400 {error:{code:"invalid_parameters"}}` (same rule as `limit` handlers — unknown query key is 400).
- Duplicate query key → 400.
- `component` not in allowlist → `400 {error:{code:"invalid_parameters"}}` with safe message; do NOT call `cscli`.
- `component` matching is exact, lowercase, hyphenated as in `cscli metrics list` (case-sensitive). No alias expansion.

**Envelope examples:**

Success (HTTP 200):
```json
{ "operation": "metrics.show", "result": { "acquisition": { "file:/var/log/auth.log": { "reads": 7395, "parsed": 4911 } } } }
```

Operation-level failures (HTTP 200):
```json
{ "operation": "metrics.show", "error": { "code": "crowdsec_failure", "message": "The CrowdSec command failed." } }
{ "operation": "metrics.show", "error": { "code": "unsupported", "message": "This operation is not supported." } }
{ "operation": "metrics.show", "error": { "code": "malformed_output", "message": "CrowdSec returned malformed output." } }
```

Request-level failures (HTTP 4xx/5xx):
```json
{ "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
```

Health remains raw `{status:"ok"}` and stays outside any envelope.

### 5.2 Component allowlist (canonical — frozen from `cscli metrics list -o json`)

```ts
const METRICS_COMPONENTS = [
  "acquisition",
  "alerts",
  "appsec-engine",
  "appsec-rule",
  "bouncers",
  "decisions",
  "lapi",
  "lapi-bouncer",
  "lapi-decisions",
  "lapi-machine",
  "parsers",
  "scenarios",
  "stash",
  "whitelists",
] as const;
```

Aliases (`engine`, `lapi`, `appsec`) are **not** accepted. If a future `cscli` adds a new type, the allowlist must be extended in code — unknown type stays 400 until then.

### 5.3 `cscli` command contract (backend → subprocess)

| Endpoint | argv (after executable) | Timeout | Stdout handling |
|----------|-------------------------|---------|-----------------|
| `GET /metrics` | `["metrics","show","-o","json"]` | `cfg.cscli_timeout_seconds` (default 30s) | `json.loads(stdout)` → `result`; empty stdout (`""`) → `{}` (empty); malformed JSON → `malformed_output` |
| `GET /metrics/{component}` | `["metrics","show",component,"-o","json"]` | same | same, but JSON is expected to contain exactly that key |
| Probe #4 | `["metrics","show","acquisition","-o","json"]` | 5.0s | `json.loads` success → `metrics.show` supported; else unsupported |

No `--url` flag, no `--no-unit` flag, no `-o human`, no shell. Argv is always validated against the allowlist before construction.

### 5.4 Configuration

No new YAML key. This feature reuses:

```yaml
cscli:
  executable_path: /usr/bin/cscli   # existing; fallbacks unchanged
  timeout: 30s                      # existing; governs metrics handlers and probe
```

Legacy `auth`/`session` blocks remain `extra="ignore"`.

### 5.5 Internal types

Backend:
```python
# backend/envelope.py
METRICS_SHOW = "metrics.show"

# backend/capabilities.py
STRUCTURED_READS  # existing 11 entries — unchanged
METRICS_OPS = ["metrics.show"]   # or inline
# probe_capabilities returns { ..., "metrics.show": {"supported": bool} }

# backend/routers/metrics/show.py
router = APIRouter(prefix="/metrics", tags=["Metrics"])
ALLOWLIST: set[str] = { ... 14 types ... }
```

Frontend:
```ts
// frontend/src/lib/api/types.ts
export const METRICS_SHOW = "metrics.show";

// frontend/src/hooks/useMetrics.ts
export type MetricsPayload = Record<string, unknown>;
export function useMetrics(component?: string): UseQueryResult<MetricsPayload>
```

## 6. Ordered Implementation Tasks (with Dependencies and Parallelization)

| # | Task | Files | Depends on | Parallelizable with |
|---|------|-------|------------|---------------------|
| T1 | **Envelope + capabilities probe** — add `METRICS_SHOW` label; extend `probe_capabilities` with Probe #4; ensure `GET /capabilities` surfaces 14 ops. | `backend/envelope.py`, `backend/capabilities.py` | — | — |
| T2 | **Metrics router** — implement `backend/routers/metrics/show.py` with `GET ""` and `GET "/{component}"`, allowlist validation, `CscliRunner.run()` calls, `classify_failure` mapping, JSON parse + `success/operation_error` envelopes, WARN log of truncated stderr. | `backend/routers/metrics/__init__.py`, `backend/routers/metrics/show.py` | T1 (needs `METRICS_SHOW` label + capability key) | — (small; sequential after T1) |
| T3 | **Wire into app** — import + `api.include_router(metrics_router)` in `backend/main.py` before static mount; verify prefix is `/api/v1/metrics`. | `backend/main.py` | T2 | — |
| T4 | **Frontend hook + types** — add `METRICS_SHOW` to `frontend/src/lib/api/types.ts`, implement `frontend/src/hooks/useMetrics.ts` via `apiGet`. | `frontend/src/lib/api/types.ts`, `frontend/src/hooks/useMetrics.ts` | T1 (label) | T2/T3 (no file overlap) |
| T5 | **Frontend page + nav** — implement `frontend/src/pages/Metrics.tsx` (selector + tables + capability badge + polling off/30s), wire into `frontend/src/App.tsx` / `router.tsx` / `Layout.tsx`. | `frontend/src/pages/Metrics.tsx`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx` | T4 | — (after T4) |
| T6 | **Docs** — update `docs/architecture.md` (probes + routes + envelope op list + out-of-scope), `docs/operations-reference.md` (endpoint table + notes), optionally `deploy/config.example.yaml` comment. | `docs/architecture.md`, `docs/operations-reference.md` | T3 + T5 (needs final route + frontend route) | — |

**Critical path:** T1 → T2 → T3 → T4 → T5 → T6. T4 can start in parallel with T2/T3 (no file overlap) if two agents available; T5 gates on T4.

**Lean staffing note:** Single agent can do T1→T6 sequentially in one pass (4 backend files + 5 frontend files + 2 docs).

## 7. Acceptance Criteria and Verification

### Backend — manual (from `backend/`, no pytest per plan D12)
```bash
# 1. Boots, probe runs, no stderr leak
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
# logs: Probe #4 line visible; no stack trace

# 2. Health unchanged
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}

# 3. Capabilities now 14 ops, metrics.show present
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'metrics.show' in d['result']; print('ok', len(d['result']))"
# → ok 14  (was 13)

# 4. Metrics — all
curl -s http://127.0.0.1:8090/api/v1/metrics | python3 -m json.tool | head -n 40
# → {"operation":"metrics.show","result":{"acquisition":{...},"alerts":{...},...}}
curl -i -s http://127.0.0.1:8090/api/v1/metrics | grep -i cache-control
# → cache-control: no-store

# 5. Metrics — per-component (valid)
curl -s http://127.0.0.1:8090/api/v1/metrics/acquisition | python3 -m json.tool | head -n 20
# → {"operation":"metrics.show","result":{"acquisition":{...}}}
curl -s http://127.0.0.1:8090/api/v1/metrics/bouncers | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'bouncers' in d['result']"

# 6. Metrics — invalid component (request-level 400, no cscli invocation)
curl -i -s http://127.0.0.1:8090/api/v1/metrics/foobar
# → HTTP/1.1 400 + {"error":{"code":"invalid_parameters", ...}}
curl -i -s "http://127.0.0.1:8090/api/v1/metrics?unknown=1"
# → HTTP/1.1 400 + {"error":{"code":"invalid_parameters", ...}}

# 7. Operation-level failures (without cscli — perform by stopping crowdsec or by tmp-breaking executable_path; then)
curl -s http://127.0.0.1:8090/api/v1/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code'] in ('unavailable','unsupported','timeout','crowdsec_failure')"

# 8. Stderr never returned (spot check)
curl -s http://127.0.0.1:8090/api/v1/metrics/bad 2>&1 | grep -q "unknown metrics type" && echo "FAIL leak" || echo "ok no leak"

# 9. Static still last — SPA fallback not shadowing /api
curl -i -s http://127.0.0.1:8090/api/v1/metrics/  2>&1 | head -n 1  # → 307/400 etc but NOT 200 text/html

# 10. Degraded mode — when Probe #4 fails (cscli missing), /metrics returns unsupported without spawning
# (kill crowdsec or rename /usr/bin/cscli, reboot dashboard, then curl)
curl -s http://127.0.0.1:8090/api/v1/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code']=='unsupported'"
```

### Frontend — manual (from `frontend/`)
```bash
npm install
npm run typecheck  # → green
npm run build      # → green; dist/index.html + dist/assets/*.js exist

# Dev proxy walk
npm run dev  # vite dev against running uvicorn (proxy /api → 127.0.0.1:8090)
# Visit:
#   /overview still renders
#   /metrics renders selector (All + 14 types), shows table for acquisition by default
#   switching to "bouncers" refetches GET /api/v1/metrics/bouncers
#   switching to "All" fetches GET /api/v1/metrics and renders multiple sections
#   with cscli missing, CapabilityBadge shows "unsupported" and page disables fetch with explanation
#   no console errors, no leaked stderr strings in UI
```

### Static E2E (with `uv` + built `frontend/dist`)
```bash
bash backend/build.sh 2>&1 | tail -n 20  # if present
curl -i http://127.0.0.1:8090/                     # → 200 text/html no-store
curl -i http://127.0.0.1:8090/assets/*.js         # → 200 immutable
curl -i http://127.0.0.1:8090/unknown-route       # → 200 index.html (SPA fallback)
curl -s http://127.0.0.1:8090/api/v1/metrics | python3 -m json.tool  # still works when dist exists
```

### Docs
```bash
grep -n "metrics.show" docs/architecture.md docs/operations-reference.md
grep -n "GET.*/metrics" docs/operations-reference.md
# no doc references Prometheus /metrics (text) as in-scope
grep -rn "/api/v1/metrics" docs/ deploy/ 2>&1 | head
```

## 8. Security, Compatibility, Migration, Operational Considerations

### Security
- **No shell** — `CscliRunner` uses `asyncio.create_subprocess_exec(*cmd)` with positional argv; `component` never interpolates into a shell string.
- **Allowlist is the injection boundary** — `component` is validated against a frozen 14-element set before argv construction; invalid input is 400 without spawning.
- **No stderr in responses** — `result.stderr` is WARN-logged (truncated 500 chars) and never placed in JSON (`classify_failure` + `SAFE_MESSAGES` only). Same invariant as every other router.
- **No auth change** — endpoint inherits existing posture (loopback-bound, no session). If reverse-proxied, keep it behind the same mTLS/basic-auth as other `/api/v1/*`.
- **DoS hygiene** — response is bounded JSON; `cscli.timeout` (30s default, max 120s) applies; no pagination needed. Consider truncating WARN log to 500 chars (existing pattern).
- **Static handler precedence** — `/api/v1/metrics` is registered on the `api` router before `mount_static`; `/api/*` never falls through to static.

### Compatibility
- **Additive only** — new route under `/api/v1/metrics`, new capability key `metrics.show`, no change to existing 13 ops, envelope, or error codes.
- **Capabilities size changes 13 → 14** — frontend that strictly asserts `Object.keys(caps).length === 13` would break; actual UI reads `caps[op]?.supported` defensively (see `Overview.tsx` / `ErrorPanel` pattern) — safe.
- **Frontend routing** — new `/metrics` client route is additive; existing 6 pages untouched. `apiGet` unchanged.
- **Config** — fully backward compatible; old YAMLs with `auth`/`session` still `extra="ignore"`; no new required key.

### Migration
- No data migration. No DB. On deploy, restart `uvicorn` (systemd) — startup probes re-run automatically. If `cscli` is absent, `metrics.show` is `unsupported` until the binary appears and the service restarts (same as all other ops).

### Operational
- **Deployment** — single `uvicorn` process, one port (8090), same `deploy/crowdsec-dashboard.service` unit; `backend/build.sh` still builds frontend then starts uvicorn.
- **Observability** — WARN logs on `crowdsec_failure/timeout/malformed_output`; Probe #4 log line at startup. No new log format.
- **Capacity** — `cscli metrics show -o json` payload can be KBs to low MBs (bouncers/packet counters); acceptable for loopback API. No caching beyond startup `supported` flag — live data on every request is intentional (metrics are counters).
- **Failure modes** — LAPI down / cscli missing / permission denied / timeout → operation-level envelope with retryable codes (`timeout`, `unavailable`) vs non-retryable (`permission_denied`, `malformed_output`, `unsupported`). Frontend shows `ErrorPanel` with Retry button that re-issues the same `GET`.

## 9. Risks, Unresolved Assumptions, and Reviewer Ownership

### Risks
| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | **Payload size / rendering cost** — "all" snapshot includes all 14 types (suricata counters, bouncer byte/packet maps) — could be heavy to render naïvely. | Medium | Medium | Frontend renders per-component by default or paginates sections; "All" page renders collapsed sections with expand toggles. Backend does not paginate — payload is still modest (<1MB observed). |
| R2 | **Heterogeneous schema** — metrics JSON shape varies per type (and across CrowdSec versions); strict TS typing will drift. | High | Low | Use `Record<string, unknown>` as the wire type; per-component tables use defensive field access (`?.`) and fallback to `<pre>` JSON view when shape is unexpected. |
| R3 | **Probe cost** — adding a 5s probe at startup slightly prolongs boot. | Low | Low | 5s is the same as probes #2/#3; total boot still < 15s. Probe is sequential; could be parallelized later if needed (not in this plan). |
| R4 | **`cscli metrics` availability** — older CrowdSec builds may lack `-o json` for metrics. | Low | Medium | Probe detects it; degraded to `unsupported` — same UX as every other op. Document in `operations-reference.md`. |
| R5 | **Confusion with Prometheus `/metrics`** — operators may expect text exposition. | Medium | Low | Docs explicitly distinguish `GET /api/v1/metrics` (dashboard JSON) from Prometheus `/metrics` (not in scope). |

### Assumptions (explicit — to confirm before T1)
| # | Assumption | If wrong, plan changes |
|---|------------|------------------------|
| A1 | `cscli metrics show -o json` and `cscli metrics show <type> -o json` are stable across supported CrowdSec versions (verified on this host: v1.6.x). | If `cscli` drops `-o json` for metrics, fallback to parsing `-o human` is out of scope — keep `unsupported` instead. |
| A2 | No new config key wanted; `cscli.timeout` (30s) is acceptable for metrics (observed ~<1s). | If dedicated timeout needed, add `metrics.timeout` — excluded now per lean scope. |
| A3 | Single operation label `metrics.show` for both `/metrics` and `/metrics/{component}` is acceptable (vs `metrics.list` + `metrics.show`). | If reviewer prefers two labels, change enrollment to `metrics.list` (all) + `metrics.show` (per-component) and add a second capability key — add one backend constant + one probe. |
| A4 | Kanban is still date-prefixed `docs/kanban/YYYY-MM-DD_<plan>/` — next board should be `docs/kanban/2026-08-16_metrics-endpoint/` if the team wants task cards. | If kanban not wanted, implement directly from this plan. |
| A5 | Frontend metrics page is desired (read-only, no Prometheus). | If API-only is preferred, drop T5 and keep T1–T4+T6 (API + docs only). |

### Reviewer ownership
- **Primary reviewer:** `crowdsec-documentation-reviewer` (wire contract + envelope invariants + docs coherence with `architecture.md` / `operations-reference.md`).
- **Secondary reviewer:** `crowdsec-command-mapper` (capability probe correctness, argv allowlist, error-code taxonomy, no-shell invariant).

## 10. Alternatives Considered

| Alt | Description | Why not chosen |
|-----|-------------|----------------|
| Single `GET /api/v1/metrics?type=acquisition` query-param filter | Would avoid a second route; more flexible if multiple types needed. | Diverges from prior `GET /metrics/{component}` shape (§11) and existing `check/{ip}` path-param precedent; allowlist still needed; comma-separated multi-type would add parsing complexity for little gain. |
| `GET /api/v1/metrics/list` + `GET /api/v1/metrics/show/{type}` mirroring `cscli` verbs | Closer to CLI. | Two labels + two capabilities for one data source; overkill. Single `metrics.show` keeps capabilities 14 not 15. |
| Pass-through Prometheus text at `GET /metrics` | Would satisfy Prometheus scraping. | Not requested; mixes concerns (scrape vs dashboard JSON); Prometheus can already scrape CrowdSec's own `/metrics` directly — no need to proxy. |

## 11. File Map (final)

| Status | Paths |
|--------|-------|
| New | `backend/routers/metrics/__init__.py`, `backend/routers/metrics/show.py`, `frontend/src/hooks/useMetrics.ts`, `frontend/src/pages/Metrics.tsx` |
| Modified | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `frontend/src/lib/api/types.ts`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/config.py`, `backend/errors.py`, `backend/static.py`, `config.yaml`, `deploy/config.example.yaml`, `deploy/crowdsec-dashboard.service` |

## 12. Open Questions for Reviewer

1. Confirm assumption A3 (single `metrics.show` label) vs splitting into `metrics.list` + `metrics.show`.
2. Should `/metrics` default to a specific component in the UI (e.g. `acquisition`) or to "All"? This plan defaults to a selector with "All" + 14 options, initially showing "All".
3. Is a 30s polling toggle wanted on the Metrics page (like `Overview.tsx`'s 30s poll) or is manual Refresh sufficient? Plan proposes off-by-default with a 30s toggle.
4. Should empty groups (`{}` for `appsec-engine` etc.) be hidden or rendered as "No data yet"? Plan proposes an explicit empty-state row per section.

---

## Appendix — Verification Checklist (copy into PR description)

- [ ] `uvicorn` boots, Probe #4 logged, `/capabilities` has 14 keys including `metrics.show`
- [ ] `GET /api/v1/metrics` → 200 `{"operation":"metrics.show","result":{...}}` + `no-store`
- [ ] `GET /api/v1/metrics/acquisition` → filtered, valid
- [ ] `GET /api/v1/metrics/foobar` → 400 `invalid_parameters`, no `cscli` spawn
- [ ] `GET /api/v1/metrics?bad=1` → 400
- [ ] Stderr never appears in any response body
- [ ] With `cscli` absent, `GET /metrics` → 200 `unsupported`
- [ ] `npm run typecheck` + `npm run build` green
- [ ] `/metrics` page renders, selector works, capability badge degrades correctly
- [ ] Old routes (`/alerts`, `/decisions`, `/bouncers`, `/machines`, `/allowlists`, `/status/*`, `/capabilities`, `/health`, static SPA) still green
