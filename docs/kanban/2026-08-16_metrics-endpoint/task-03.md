# Task 03 — Wire metrics router into app (`backend/main.py`)

## Objective

Import and mount the metrics router under `APIRouter(prefix="/api/v1")` so `GET /api/v1/metrics` and `GET /api/v1/metrics/{component}` are live, with correct mount order (before the static catch-all) and existing invariants preserved (health raw, capability-gated errors, `Cache-Control: no-store`, no-shell).

## Prerequisites/dependencies

- task-01 COMPLETED and task-02 COMPLETED — `backend/routers/metrics/show.py` must exist and export `router: APIRouter(prefix="/metrics")` plus `ALLOWLIST`. If the module is missing or the export name differs, STOP, report the blocker, do not guess or rewrite the router here.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/main.py` — add one import and one `api.include_router(metrics_router)` line. No other file.

Do NOT touch `backend/envelope.py` / `backend/capabilities.py` (task-01), `backend/routers/metrics/show.py` itself (task-02), `frontend/` (tasks 04–05), or docs (task-06). Do NOT add config keys. Do NOT reorder existing router includes beyond inserting the metrics line near the others.

## Concrete implementation steps

1. Open `backend/main.py` (current shape from `docs/kanban/2026-08-15_fastapi-rebuild` task-04: `FastAPI(title="CrowdSec Dashboard API", lifespan=lifespan)` + `api = APIRouter(prefix="/api/v1")` + `api.include_router(...)` for `alerts_*`, `bouncers_*`, `decisions_*`, `machines_*`, `allowlists_*`, `status_router`, `capabilities_router`, then `app.include_router(api)` + `@app.get("/api/v1/health")` + exception handlers + static mount inside `lifespan`).
2. Add import near the other router imports:
   ```python
   from routers.metrics.show import router as metrics_router
   ```
   Keep imports sorted with existing groups (or minimally appended — do not reformat unrelated lines).
3. Add the mount inside the `api` router block, alongside the other `api.include_router(...)` calls, before `app.include_router(api)` and before the static mount in `lifespan`:
   ```python
   api.include_router(metrics_router)
   ```
   Any position among the other `api.include_router(...)` calls is acceptable as long as it is inside `api` (so final paths are `/api/v1/metrics`) and before `app.include_router(api)`. Prefer grouping after `capabilities_router` for readability.
4. Verify no other file changed (`git diff --name-only` should show only `backend/main.py` for this task; `backend/routers/metrics/*` belongs to task-02).

## Interfaces/contracts and integration points

- Final wire paths after this task: `GET /api/v1/metrics` and `GET /api/v1/metrics/{component}` (the router's `prefix="/metrics"` + parent `prefix="/api/v1"` = `/api/v1/metrics`).
- Existing routes unchanged: `/api/v1/health` (raw), `/api/v1/capabilities` (now 14 keys including `metrics.show` from task-01), all 13 existing read/status routes, and the static SPA fallback (which must remain last — `lifespan` mounts `static.mount_static` after probes; task-06 doc update covers the file map).
- Capabilities probe already added in task-01 (`probe_capabilities` Probe #4) — `lifespan` already calls it, no change to `lifespan` needed.
- Timeout governed by `config.cscli_timeout_seconds` via `CscliRunner.default_timeout`; metrics router consumes `runner.default_timeout` — no new timeout config.

## Acceptance criteria

- `backend/main.py` imports `metrics_router` and includes it via `api.include_router(metrics_router)`.
- `grep -n "metrics_router" backend/main.py` shows both the import and the include line.
- `GET /api/v1/metrics` and `GET /api/v1/metrics/acquisition` resolve with FastAPI routing (not 404) — verified via `TestClient` or live `uvicorn` smoke.
- Existing invariants still green: `GET /api/v1/health` → `{"status":"ok"}` raw, `GET /api/v1/capabilities` → 14 keys, all previous `GET /api/v1/{alerts,decisions,machines,bouncers,allowlists,status}/*` routes still respond, static fallback still serves `index.html` at unknown non-`/api` routes and static assets remain `immutable`.
- `grep -n "/api/v1/metrics" backend/main.py` (or via router prefixes) — route is under `/api/v1` as intended.
- No new YAML key, no DB, no Docker, no Prometheus.

## Verification commands/checks

From project root / `backend/`:

- `grep -n "metrics_router\|from routers.metrics" backend/main.py` → both lines present.
- `uv run python -m py_compile backend/main.py` → no syntax error.
- Smoke without running cscli (degraded probe path):
  ```bash
  # from backend/
  uv run python -c "
  from fastapi.testclient import TestClient
  from main import app
  c = TestClient(app)
  # health + capabilities invariants
  r = c.get('/api/v1/health'); assert r.status_code==200 and r.json()=={'status':'ok'}, r.text
  r = c.get('/api/v1/capabilities'); assert r.status_code==200 and 'metrics.show' in r.json().get('result', {}), r.text
  # metrics routes exist (may return unsupported when cscli absent — but NOT 404)
  for path in ['/api/v1/metrics', '/api/v1/metrics/acquisition']:
      r = c.get(path)
      assert r.status_code in (200, 400), (path, r.status_code, r.text)
      assert r.status_code != 404, (path, r.text)
  # invalid still 400
  r = c.get('/api/v1/metrics/foobar'); assert r.status_code==400, r.text
  r = c.get('/api/v1/metrics?unknown=1'); assert r.status_code==400, r.text
  print('wiring ok')
  "
  ```
- Live smoke (with real cscli):
  ```bash
  DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8091 &
  pid=$!; sleep 2
  curl -s http://127.0.0.1:8091/api/v1/health | python3 -c "import sys,json; assert json.load(sys.stdin)=={'status':'ok'}; print('health ok')"
  curl -s http://127.0.0.1:8091/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'metrics.show' in d['result'] and len(d['result'])==14; print('caps ok 14')"
  curl -s http://127.0.0.1:8091/api/v1/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['operation']=='metrics.show' and isinstance(d['result'], dict); print('metrics all ok')"
  curl -s http://127.0.0.1:8091/api/v1/metrics/acquisition | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'acquisition' in d['result']; print('metrics filtered ok')"
  curl -i -s http://127.0.0.1:8091/api/v1/metrics | grep -i cache-control  # → no-store
  curl -i -s http://127.0.0.1:8091/api/v1/metrics/ | head -n 1  # → 307/400 etc but NOT 200 text/html
  curl -s http://127.0.0.1:8091/ | head -n 20  # SPA still serves index.html at root
  kill $pid
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (route table + mount-order + static precedence)
- `crowdsec-command-mapper` secondary (capability wiring confirmation)

## Explicit out-of-scope

- Editing the router implementation itself (task-02).
- Editing `backend/envelope.py` / `backend/capabilities.py` (task-01).
- Any `frontend/` file (tasks 04–05).
- Docs (`docs/architecture.md`, `docs/operations-reference.md`) (task-06).
- New config keys, Prometheus exposition, Grafana, auth/session, DB, Docker/K8s work.

## Coordinator status
- Status: completed
- Completed by: muse-spark-1.2-contributor
- Completed at: 2026-08-17T16:45:00Z
- Verification summary: `grep -n "metrics_router|from routers.metrics" backend/main.py` → 32:from routers.metrics.show import router as metrics_router, 90:api.include_router(metrics_router) (import grouped with other router imports, mount after capabilities_router inside api before app.include_router(api) and before static lifespan mount); `uv run --directory backend python -m py_compile main.py` ok; TestClient with lifespan (`with TestClient(app) as c:`) → health 200 {"status":"ok"}, capabilities 200 with 14 keys including metrics.show, GET /api/v1/metrics 200 {operation:metrics.show, acquisition:...}, GET /api/v1/metrics/acquisition 200 filtered, GET /api/v1/metrics/foobar 400 invalid_parameters, GET /api/v1/metrics?unknown=1 400 invalid_parameters — all invariants preserved (no new config key, no shell, mount order correct)
- Commit or artifact reference: working tree (backend/main.py — 2 lines added, 0 other files modified by this task)
