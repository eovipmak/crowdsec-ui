# Task 05 — Status routers: `/status/lapi` and `/status/capi`

## Objective

Implement the two "human-output" (no JSON) status endpoints per plan §3.3 + §5: `GET /api/v1/status/lapi` → `{"operation":"status.lapi","result":{"healthy":<bool>}}`, `GET /api/v1/status/capi` → `{"operation":"status.capi","result":{"enabled":<bool>}}`. Both consult `app.state.capabilities` and short-circuit to `operation_error(op, UNSUPPORTED)` when probed `unsupported` (task-03's probe #2/#3 mark them). Both log `result.stderr` at WARN and never include stderr in the response.

## Prerequisites/dependencies

- task-01 COMPLETED (config + envelope + errors constants).
- task-02 COMPLETED (`CscliRunner` + `RunResult` + `classify_failure`).
- task-03 COMPLETED (`capabilities.probe_capabilities` set up — this task consumes `app.state.capabilities["status.lapi"]` / `["status.capi"]` but does NOT call `probe_capabilities` directly).

## Owner / recommended agent profile

- Implementer: `crowsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `backend/routers/status.py` — exports `router: APIRouter`.

Do NOT touch `backend/main.py` (task-04 wires it), `backend/capabilities.py` (task-03 owns it), or any read handler (tasks 06/07).

## Concrete implementation steps

1. Define:
   ```python
   from fastapi import APIRouter, Request
   from envelope import success, operation_error
   from errors import UNSUPPORTED, TIMEOUT, UNAVAILABLE, PERMISSION_DENIED, CROWDSEC_FAILURE
   from routers.cscli import CscliRunner, RunResult, classify_failure

   router = APIRouter(prefix="/status", tags=["Status"])

   @router.get("/lapi")
   async def status_lapi(request: Request):
       caps = getattr(request.app.state, "capabilities", {})
       if not caps.get("status.lapi", {}).get("supported"):
           return operation_error("status.lapi", UNSUPPORTED)
       runner: CscliRunner = request.app.state.runner
       result = await runner.run(["lapi","status"], timeout=5.0)
       if result.deadline_exceeded or result.exec_missing or result.eacces or result.exit_code != 0:
           # classify and log stderr, never include in response
           code = classify_failure(result)
           # log: _logger.warning("cscli lapi status failed: %s", result.stderr.decode(errors="replace"))
           return operation_error("status.lapi", code)
       text = result.stdout.decode(errors="replace").lower()
       healthy = "successfully interact" in text
       return success("status.lapi", {"healthy": healthy})

   @router.get("/capi")
   async def status_capi(request: Request):
       caps = getattr(request.app.state, "capabilities", {})
       if not caps.get("status.capi", {}).get("supported"):
           return operation_error("status.capi", UNSUPPORTED)
       runner: CscliRunner = request.app.state.runner
       result = await runner.run(["capi","status"], timeout=5.0)
       if result.deadline_exceeded or result.exec_missing or result.eacces or result.exit_code != 0:
           code = classify_failure(result)
           return operation_error("status.capi", code)
       text = result.stdout.decode(errors="replace")
       enabled = text.strip() != ""
       return success("status.capi", {"enabled": enabled})
   ```
2. Logger: use Python's stdlib `logging.getLogger("cscli.status")` referenced at module scope. Log at `warning` level: the matched substring-preview of `result.stderr` (capped at 200 chars) only — NEVER the full stderr if it could contain a secret-like token. (cscli's `lapi status`/`capi status` stderr typically has no secrets, but be defensive: log at most a truncated preview.)

## Interfaces/contracts and integration points

- `GET /api/v1/status/lapi` and `GET /api/v1/status/capi` are PUBLIC (plan D5 — no auth). Mounted under `/api/v1` by task-04.
- Reads `request.app.state.capabilities` and `request.app.state.runner` set by task-04's lifespan.
- The `healthy`/`enabled` field name + bool type MUST match `frontend/src/lib/api/types.ts` (task-09) exactly.

## Acceptance criteria

- `router` exposes two GET routes (FastAPI `app.routes` lists `/status/lapi` and `/status/capi` after mounting).
- Both short-circuit to `operation_error(op, UNSUPPORTED)` when `app.state.capabilities["status.<x>"]["supported"]` is `False` (or missing).
- When `runner.executable_path is None`: `result.exec_missing=True` → `operation_error(op, UNAVAILABLE)` (because `executable_path=None` ⇒ `app.state.capabilities["status.lapi"]` will be `{"supported":False}` from probe failure ⇒ short-circuits at `UNSUPPORTED`; BOTH outcomes are valid because the runtime falls through before invoking cscli — confirm with `classify_failure` consistency).
- No response body contains `result.stderr`.

## Verification commands/checks

From `backend/`, after task-04 also lands (i.e., via `uvicorn`):
- `curl http://127.0.0.1:8090/api/v1/status/lapi` → either:
  - `{"operation":"status.lapi","result":{"healthy":<bool>}}` (cscli installed), OR
  - `{"operation":"status.lapi","error":{"code":"unsupported","message":...}}` (cscli missing).
- Same shape for `/status/capi`.
- `grep -nE 'detail=.*stderr|return.*stderr' backend/routers/status.py` → no matches (no stderr leak).

If task-04 not landed yet: use the manual `TestClient` smoke below:
```python
uv run python -c "
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers.cscli import CscliRunner
from routers.status import router as status_router
from capabilities import probe_capabilities
import asyncio
app = FastAPI()
api = app.router if False else __import__('fastapi').APIRouter(prefix='/api/v1')
api.include_router(status_router)
app.include_router(api)
app.state.runner = CscliRunner(None, 5.0)
app.state.capabilities = asyncio.run(probe_capabilities(app.state.runner))
c = TestClient(app)
r = c.get('/api/v1/status/lapi')
assert r.status_code == 200
print(r.json())
"
```

## Explicit out-of-scope

- Editing `backend/main.py` to wire the router (task-04).
- Implementing the capabilities probe itself (task-03).
- Tests/pytest.
- Editing the source plan.

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
