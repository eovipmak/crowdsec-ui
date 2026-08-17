# Task 03 — Wire hub router into `backend/main.py`

## Objective

Mount the new Hub router in `backend/main.py` under the `/api/v1` prefix before the static SPA file fallback mount, ensuring the `/api/v1/hub` route is reachable and the application lifespan probe runs correctly.

## Prerequisites/dependencies

- task-02 COMPLETED — requires `backend/routers/hub/list.py:router`. If missing, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/main.py` — import `from routers.hub.list import router as hub_router` and call `api.include_router(hub_router)` before `mount_static`.

Do NOT touch `backend/routers/hub/*` (task-02), `backend/capabilities.py` (task-01), or any frontend files (tasks 04–05).

## Concrete implementation steps

1. In `backend/main.py`:
   - Add import: `from routers.hub.list import router as hub_router`.
   - In router registration section (where `alerts_router`, `decisions_router`, `machines_router`, `bouncers_router`, `allowlists_router`, `status_router`, `metrics_router` are registered), add:
     `api.include_router(hub_router)`.
   - Ensure registration remains under the `/api/v1` `api` sub-router and precedes `mount_static(app, static_dir)` so static SPA fallback never shadows `/api/v1/hub`.

## Interfaces/contracts and integration points

- Path: `/api/v1/hub` exposed on the FastAPI application.
- Startup lifespan: `probe_capabilities()` logs Probe #5 and populates `app.state.capabilities["hub.list"]`.
- Static fallthrough: any unmatched `/api/*` route must return 404/request error; non-API routes return SPA `index.html`.

## Acceptance criteria

- `backend/main.py` imports and includes `hub_router` under `/api/v1`.
- `main.py` compiles without syntax or import errors.
- Starting `uvicorn main:app` boots cleanly without traceback.
- `GET /api/v1/hub` routes directly to `hub_router`.
- Probe #5 log line is emitted during lifespan startup.
- `GET /api/v1/capabilities` returns a 15-key JSON object containing `"hub.list"`.
- Static SPA fallback still works for unknown client paths without shadowing `/api/v1/hub`.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile main.py` → no syntax errors.
- Run server and verify endpoints:
  ```bash
  uv sync
  DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &
  SERVER_PID=$!
  sleep 2
  curl -s http://127.0.0.1:8090/api/v1/health | grep -q "ok" && echo "Health OK"
  curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'hub.list' in d['result'] and len(d['result'])==15; print('Capabilities 15 OK')"
  curl -s http://127.0.0.1:8090/api/v1/hub | python3 -m json.tool | head -n 30
  curl -i -s "http://127.0.0.1:8090/api/v1/hub?unknown=1" | grep -q "400" && echo "Query rejection OK"
  kill $SERVER_PID
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (route precedence, static mounting invariants)

## Explicit out-of-scope

- Modifying router handlers (task-02 owns `routers/hub/list.py`).
- Frontend hooks or page components (tasks 04–05).
- Config file changes or new YAML schema keys.
- Prometheus `/metrics` text exposition, DB, auth/session.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-17T00:00:00Z
- Verification: `uv run python -m py_compile main.py` passed; TestClient verified /api/v1/capabilities 15 keys, /api/v1/hub data routing, and 400 query rejection.
- Commit or artifact reference: working tree
