# Task 04 — `main.py` rewrite: `/api/v1` prefix, lifespan startup, router wiring

## Objective

Rewrite `backend/main.py` to: establish the canonical `/api/v1` prefix for every API router, wire the lifespan startup (load config → resolve cscli path → `CscliRunner` → `probe_capabilities` → `app.state`), mount every Wave-2 router (reads/migrations produced by tasks 03/05/06/07), install request-error envelope exception handlers (FastAPI 404/405/422 → the safe request-error body per plan §3.2), and mount the static handler produced by task-08 LAST (so `/api/*` never falls through).

**This task is the integration hub — wait for every Wave-2 task it depends on.** Once it lands, the backend boots end-to-end.

## Prerequisites/dependencies

- task-01 COMPLETED (config + envelope + errors).
- task-02 COMPLETED (`CscliRunner` + `RunResult` + `classify_failure`).
- task-03 COMPLETED (`capabilities.probe_capabilities` + `routers/capabilities.py`).
- task-05 COMPLETED (`routers/status.py` with `status_router`).
- task-06 COMPLETED (`routers/alerts/__init__.py` + `routers/bouncers/__init__.py` exports rewritten to the migrated routers).
- task-07 COMPLETED (`routers/decisions/__init__.py` + `routers/machines/__init__.py` + `routers/allowlists/__init__.py` exports rewritten).
- task-08 is NOT a precondition — task-04 wires a forward-reference try/import guard for `static.mount_static` (task-08 ships it before this task runs in production, but during iterative dev, the import guard lets `main.py` boot without static serving yet).

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **REWRITE** `backend/main.py`.
- **MODIFY (only if needed for the legacy `run_cscli` stub removal)** `backend/routers/cscli.py` — check whether all callers migrated to `CscliRunner.run`; if yes, delete `run_cscli`/`set_default_runner` (and their imports in migrated routers — verify first with `grep -n run_cscli backend/routers/`).

## Concrete implementation steps

1. Imports:
   - `from contextlib import asynccontextmanager`
   - `from fastapi import FastAPI, HTTPException, Request`
   - `from fastapi.responses import JSONResponse`
   - `from fastapi.exceptions import RequestValidationError, HTTPException as FastAPIHTTPException`
   - `from starlette.exceptions import HTTPException as StarletteHTTPException`
   - `from config import load_config, resolve_cscli_path, Config`
   - `from routers.cscli import CscliRunner`
   - `from capabilities import probe_capabilities`
   - `from envelope import success, operation_error, health_ok, request_error_body`
   - `import errors`
   - Router imports — every one prefixed under `/api/v1`:
     - `from routers.alerts import list_router, inspect_router` (task-06 renamed exports from `alerts_list`/`alerts_inspect` to `list_router`/`inspect_router` — confirm the actual export name when this task runs; adapt).
     - `from routers.bouncers import list_router as b_list, inspect_router as b_inspect` (task-06).
     - `from routers.decisions import list_router as d_list, check_router as d_check` (task-07).
     - `from routers.machines import list_router as m_list, inspect_router as m_inspect` (task-07).
     - `from routers.allowlists import list_router as a_list, inspect_router as a_inspect, check_router as a_check` (task-07).
     - `from routers.status import router as status_router` (task-05).
     - `from routers.capabilities import router as capabilities_router` (task-03).
2. Lifespan:
   ```python
   @asynccontextmanager
   async def lifespan(app: FastAPI):
       cfg = load_config(_resolve_config_path())
       runner = CscliRunner(resolve_cscli_path(cfg), cfg.cscli_timeout_seconds)
       app.state.config = cfg
       app.state.runner = runner
       app.state.capabilities = await probe_capabilities(runner)
       static_mount = None
       try:
           from static import mount_static
           static_mount = mount_static(app, cfg)
       except Exception:
           pass  # task-08 not landed yet in dev; silently skip
       yield
       # (no startup cleanup required: sessions/etc. dropped from this scope)
   ```
3. `_resolve_config_path() -> str`: return the env `DASHBOARD_CONFIG` if set; else try `../config.yaml` (repo root from `backend/`); else `/etc/crowdsec-dashboard/config.yaml`; else return `"config.yaml"` (will fall back to default model via `load_config` when missing).
4. App factory:
   ```python
   app = FastAPI(title="CrowdSec Dashboard API", version="1.0.0", lifespan=lifespan)
   api = APIRouter(prefix="/api/v1")
   api.include_router(...) for each read/status/capabilities router.
   app.include_router(api)
   @app.get("/api/v1/health")
   async def health(): return health_ok()
   ```
   Health route can live OUTSIDE the `/api/v1` prefix-attached `api` router — both placements yield `/api/v1/health` if health is attached to `api` with `prefix=""`. Simpler: attach `health` directly to `app` at `/api/v1/health` literal. Pick ONE and document in a one-line comment.
5. Exception handlers (wrap FastAPI defaults in the request-error envelope — plan §3.2):
   - `@app.exception_handler(FastAPIHTTPException)` (covers 404/405/etc): if the raised `HTTPException` carries `detail` as a dict already in the request-error format, return it as-is; else map: 404→`errors.NOT_FOUND`, 405→`errors.METHOD_NOT_ALLOWED`, 500→`errors.INTERNAL`, default→`errors.INTERNAL`; body via `request_error_body(code, status=exc.status_code)`.
   - `@app.exception_handler(RequestValidationError)` (FastAPI's 422): return `request_error_body(errors.INVALID_PARAMETERS, status=400)` with the SAFE message (do NOT leak the field-level validation detail — D7 in AGENTS.md "secret-safe").
   - `@app.exception_handler(Exception)`: return `request_error_body(errors.INTERNAL, status=500)` with the safe message; log the exception at error level (never put the traceback or `str(exc)` in the response body).
6. Mount the static handler (task-08) LAST via the lifespan try-guard in step 2 OR after `include_router(api)` — pick the invokation shape that task-08 exposes (`mount_static(app, cfg)`). The static mount MUST come AFTER the API router so `/api/*` is matched first.
7. Legacy cleanup: `grep -rn 'from .*cscli import run_cscli' backend/routers/` — if zero callers remain (all migrated to `CscliRunner`), delete `run_cscli`/`set_default_runner` from `backend/routers/cscli.py`. If any remain, leave them (the task is half-done; record which).

## Interfaces/contracts and integration points

- `app.state.config`, `app.state.runner`, `app.state.capabilities` are the three state attributes every read handler reads.
- The `/api/v1` prefix is canonical — any router added later MUST go under `api.include_router(...)` (it will surface under `/api/v1/<router.prefix>...`).
- The exception handlers convert FastAPI default responses into plan §3.2 envelopes; downstream tasks MUST NOT raise raw `HTTPException(500, detail=stderr)` (task-02 already removed that in `cscli.py`; verify no migrated router reintroduces it via `grep -rn 'detail=stderr' backend/`).
- The static mount order matters: API router first, static last. `curl /api/v1/health` MUST hit the API router, NEVER the static fallback.

## Acceptance criteria

- `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --port 8090` boots without error; startup logs show "config loaded", "cscli path resolved", "capabilities probed".
- `curl http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}` HTTP 200.
- `curl http://127.0.0.1:8090/api/v1/capabilities` → `{"operation":"capabilities.list","result":{...13 ops...}}`.
- `curl -i 'http://127.0.0.1:8090/api/v1/alerts?limit=999'` → HTTP 400 `{"error":{"code":"invalid_parameters","message":"The request parameters are invalid."}}`.
- `curl http://127.0.0.1:8090/api/v1/alerts/abc` (non-int path param) → HTTP 422 mapped to HTTP 400 `invalid_parameters` safe envelope (leveraged from the `RequestValidationError` handler).
- `curl -i -X POST http://127.0.0.1:8090/api/v1/alerts` → HTTP 405 `{"error":{"code":"method_not_allowed",...}}`.
- On a host WITHOUT cscli: `curl /api/v1/alerts` → `{"operation":"alerts.list","error":{"code":"unavailable",...}}` (because `app.state.capabilities["alerts.list"]["supported"]` is `False`, the read handler short-circuits per tasks 06/07 to `operation_error(op, UNSUPPORTED)` — OR the handler invokes the runner whose `executable_path is None` → `exec_missing` → `unavailable`; BOTH are valid — confirm with the actual handler design in tasks 06/07 and align here).
- `grep -rn 'detail=stderr\|"detail".*stderr' backend/` → no matches.

## Verification commands/checks

From `backend/`:
- `uv sync` → green.
- `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &` then in a new shell:
  - `curl -s http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}`.
  - `curl -s http://127.0.0.1:8090/api/v1/capabilities` → JSON envelope.
  - `curl -si 'http://127.0.0.1:8090/api/v1/alerts?limit=999' | head -1` → `HTTP/1.1 400 Bad Request`.
  - `curl -s -X POST -i http://127.0.0.1:8090/api/v1/alerts | head -1` → `HTTP/1.1 405 Method Not Allowed`.
- `grep -rn 'detail=stderr' backend/` → no matches.
- `grep -nE 'APIRouter\(prefix="/api/v1"' backend/main.py` OR `app.include_router\(api\)` present → confirms the prefix wrapper exists.

## Explicit out-of-scope

- Implementing or modifying read/status/capabilities handlers (tasks 03/05/06/07) — this task only imports and wires them.
- Implementing static serving itself (task-08) — only the lifespan guard + ordering here.
- Frontend (tasks 09/10).
- Deploy/docs (task-11).
- Tests/pytest (D12 — the `TestClient` smoke above is acceptable but NOT a suite).
- Editing the source plan.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper (via coordinator)
- Completed at: 2026-08-16T13:25:00Z
- Verification: `uv sync` green; `uv run python -c "from fastapi.testclient import TestClient; from main import app; c=TestClient(app); ..."` smoke → `task-04 ALL CHECKS OK` (health 200 {"status":"ok"}; capabilities envelope 200; status/lapi 200; `alerts?limit=999` → 400 invalid_parameters; `alerts/inspect/abc` → 400 invalid_parameters; `POST /alerts` → 405 method_not_allowed; `GET /alerts` → 200); `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --port 8090` boots cleanly "Application startup complete"; `curl /api/v1/health` → 200 {"status":"ok"}; `curl /api/v1/capabilities` → envelope with 13 ops; `grep -rn 'detail=stderr' backend/` → no matches; `grep -nE 'APIRouter(prefix="/api/v1"|app.include_router(api)' backend/main.py` → both present at lines 75 & 89; legacy `run_cscli`/`set_default_runner` stubs deleted from `backend/routers/cscli.py` after grep confirmed zero callers
- Commit or artifact reference: working tree
