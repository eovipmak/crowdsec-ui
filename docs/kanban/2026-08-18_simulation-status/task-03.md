# Task 03 — Wire simulation router into `backend/main.py`

## Objective

Wire the simulation router into the FastAPI app so `GET /api/v1/simulation` is reachable under the existing `/api/v1` prefix, before the static catch-all, with no change to health, capabilities, or existing routes.

## Prerequisites/dependencies

- task-02 COMPLETED — requires `backend/routers/simulation/status.py` exporting `router = APIRouter(prefix="/simulation")`. If that file or export is missing, STOP, report the blocker, do not guess.
- `backend/main.py` at post-`2026-08-17` state (hub wired, 5 probes). `backend/envelope.py` and `backend/capabilities.py` already extended by task-01.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/main.py` — add import `from routers.simulation.status import router as simulation_router` and `api.include_router(simulation_router)` under the existing `APIRouter(prefix="/api/v1")` before the static mount. No other file.

Do NOT touch `backend/envelope.py`, `backend/capabilities.py` (task-01), `backend/routers/simulation/*` (task-02), or any `frontend/*` (tasks 04–05), or `docs/*` (task-06).

## Concrete implementation steps

1. Read `backend/main.py` and locate the `api = APIRouter(prefix="/api/v1")` block and the sequence of `api.include_router(...)` calls (alerts, decisions, machines, bouncers, allowlists, status, capabilities, metrics, hub — in current order).
2. Add import near the other router imports:
   ```python
   from routers.simulation.status import router as simulation_router
   ```
3. Add include after `hub_router` (or after `metrics_router` if hub not yet present — but after task-02 it is):
   ```python
   api.include_router(simulation_router)
   ```
4. Verify ordering: the `app.include_router(api)` call and `mount_static` (via `lifespan` or explicit call) remain AFTER all `api.include_router` calls, so `/api/v1/simulation` never falls through to static. Health (`@app.get("/api/v1/health")`) stays outside the `api` router as before.
5. Run syntax check: `uv run python -m py_compile main.py`.

## Interfaces/contracts and integration points

- Mount point: `api.include_router(simulation_router)` makes the route `GET /api/v1/simulation` (because `simulation/status.py` defines `prefix="/simulation"` and `GET ""`).
- Capability key: `simulation.status` is already in `app.state.capabilities` from task-01's Probe #6 — the router's capability gate reads it.
- Static precedence: `mount_static` is last — `/api/*` never served by static handler. `GET /api/v1/simulation?bad=1` is still 400 before static.
- No new config key, no new env var, no new systemd unit.

## Acceptance criteria

- `backend/main.py` imports `simulation_router` and includes it on the `api` router.
- `grep -n "simulation_router" backend/main.py` shows both import and `api.include_router(simulation_router)`.
- `uv run python -m py_compile main.py` passes.
- `grep -n "include_router" backend/main.py` shows simulation included alongside alerts/decisions/machines/bouncers/allowlists/status/capabilities/metrics/hub — no duplicate prefix, no missing router.
- No change to `DASHBOARD_CONFIG` handling, `resolve_cscli_path`, `lifespan`, or exception handlers.

## Verification commands/checks

From `backend/`:

- `grep -n "simulation" main.py` → import + include visible.
- `uv run python -m py_compile main.py` → no syntax errors.
- Boot check: `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090` → logs show Probe #6 line, no import error.
- `curl -s http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}` (health still outside envelope).
- `curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'simulation.status' in d['result']; print('ok', len(d['result']))"` → `ok 16`.
- `curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'operation' in d; print(d['operation'])"` → `simulation.status` (either success or operation_error depending on cscli availability).
- `curl -i -s "http://127.0.0.1:8090/api/v1/simulation?bad=1" | head -n 5` → `HTTP/1.1 400` with `invalid_parameters` (query rejection, not static fallback).

## Reviewer

- `crowdsec-documentation-reviewer` (route table coherence, static precedence)
- `crowdsec-command-mapper` secondary for import/include correctness.

## Explicit out-of-scope

- Modifying `backend/envelope.py` / `backend/capabilities.py` (task-01).
- Modifying `backend/routers/simulation/status.py` (task-02) — import it, don't rewrite it.
- Any frontend file (tasks 04–05).
- Docs (`docs/architecture.md`, `docs/operations-reference.md`) — task-06.
- New YAML keys, DB, Docker/K8s, auth/session, mutations.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-18T00:00:00Z
- Verification: grep -n "simulation" main.py shows import (line 34) + include_router (line 94), py_compile green, boot test clean (uvicorn started/shut down without errors), no existing routers/config/lifespan modified
- Commit or artifact reference: working tree

