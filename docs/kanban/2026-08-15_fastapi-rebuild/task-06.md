# Task 06 — Migrate `alerts/*` and `bouncers/*` routers to the envelope + `CscliRunner`

## Objective

Migrate the existing prototype `alerts/{list,inspect}.py` and `bouncers/{list,inspect}.py` handlers from the legacy `async run_cscli(*args)` + raw-return pattern to the new `CscliRunner.run` + `envelope.success/operation_error` pattern (plan §3.1). Fix every error path so cscli's stderr NEVER appears in any response body (plan §3.2). Preserve the existing field-flattening transforms (they are sensible). Capabilities short-circuit when `app.state.capabilities[op].supported is False`.

## Prerequisites/dependencies

- task-01 COMPLETED (`envelope`, `errors`).
- task-02 COMPLETED (`CscliRunner`, `RunResult`, `classify_failure`).

## Owner / recommended agent profile

- Implementer: `crowsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/routers/alerts/__init__.py`, `backend/routers/alerts/list.py`, `backend/routers/alerts/inspect.py`.
- **MODIFY** `backend/routers/bouncers/__init__.py`, `backend/routers/bouncers/list.py`, `backend/routers/bouncers/inspect.py`.

Do NOT touch `backend/main.py` (task-04), `backend/capabilities.py`/`routers/capabilities.py` (task-03), `backend/routers/status.py` (task-05), or `backend/routers/{decisions,machines,allowlists}/*` (task-07).

## Concrete implementation steps

### 6.1 alerts/list.py

1. Replace the `from ..cscli import run_cscli` import with:
   ```python
   from fastapi import APIRouter, Query, Request
   from .cscli import CscliRunner, RunResult, classify_failure
   # NOTE: `.cscli` is a sibling relative import — confirm the package layout (`routers/cscli.py` at `routers/` package root, `routers/alerts/` is a sub-package: so `from ..cscli import ...` is two dots, one level up to `routers`). Use `from ..cscli import ...`.
   from ..cscli import CscliRunner, RunResult, classify_failure
   from ..envelope import success, operation_error
   from ..errors import UNSUPPORTED, INVALID_PARAMETERS, NOT_FOUND
   ```
2. Define `list_router = APIRouter(prefix="/alerts", tags=["Alerts"])`.
3. Handler `GET ""` (so the route is `/alerts`; permit `/alerts/` via FastAPI redirect):
   ```python
   @list_router.get("")
   async def list_alerts(
       request: Request,
       limit: int = Query(50, ge=1, le=100, description="1..100"),
       scenario: str | None = Query(None),
       ip: str | None = Query(None),
   ):
       caps = getattr(request.app.state, "capabilities", {})
       if not caps.get("alerts.list", {}).get("supported"):
           return operation_error("alerts.list", UNSUPPORTED)
       runner: CscliRunner = request.app.state.runner
       # argv vector decided inline (plan §4/D11 — no command-matrix doc).
       argv = ["alerts", "list", "-m", "-l", str(limit), "-o", "json"]
       result = await runner.run(argv, timeout=runner.default_timeout)
       if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
           code = classify_failure(result)
           # log WARN: result.stderr.decode(errors="replace")[:500]
           return operation_error("alerts.list", code)
       raw = json.loads(result.stdout.decode()) if result.stdout else []
       # REUSE the existing extract_meta + flatten pipeline — keep the same field mapping.
       items = [_flatten_alert(a) for a in raw]  # _flatten_alert and extract_meta already coded; keep them.
       # Apply post-filters (scenario, ip) — keep the current post-filter logic.
       if scenario: items = [x for x in items if x.get("scenario") == scenario]
       if ip: items = [x for x in items if x.get("source_ip") == ip]
       return success("alerts.list", items)
   ```
4. Keep the existing `extract_meta` / `_flatten_alert` helpers (rename if you want; behavior preserved).

### 6.2 alerts/inspect.py

5. Replace imports per §6.1.
6. Define `inspect_router = APIRouter(prefix="/alerts", tags=["Alerts"])` — NOTE the prefix collision with `list_router`; since they are sibling `APIRouter`s but share the same prefix, FastAPI will accept it (routes `GET ""` vs `GET "/inspect/{alert_id}"`), but to keep mgmt clean, set:
   ```python
   inspect_router = APIRouter(prefix="/alerts/inspect", tags=["Alerts"])
   @inspect_router.get("/{alert_id}")
   async def inspect_alert(request: Request, alert_id: int):
       ...
   ```
   Final path = `/api/v1/alerts/inspect/{alert_id}` (NOT `/api/v1/alerts/{id}` — but keep the existing path for now; task-04's frontend contract says `/alerts/{id}`. **For minimal churn: keep `/alerts/inspect/{alert_id}` (existing prototype path) and update the frontend task to call that.** Confirm with task-09 owner — the contract route table lists BOTH `GET /alerts/{id}` AND the prototype's `/alerts/inspect/{id}`; the latter is what's coded, the former is a "would-be-nice". Decide which the SPA calls — recommend keeping `/alerts/inspect/{alert_id}` to minimize churn.)
7. Handler body: short-circuit capabilities (op `alerts.inspect`); `argv = ["alerts","inspect",str(alert_id),"-o","json"]`; on failure (exit_code≠0 with stderr message containing `"not found"` OR `exit_code != 0` generally), distinguish:
   - Probe-driven capability says supported, but the specific alert lookup failed → `operation_error("alerts.inspect", NOT_FOUND)`.
   - Other cscli errors → `classify_failure` + `operation_error`.
   - Avoid substring-matching stderr like the current prototype does; instead base the not-found decision on: exit_code ≠ 0 AND stderr-lowercase contains `"not found"`/`"no alert"`/`"doesn't exist"` — this is acceptable because stderr is being scanned ONLY to choose the op-error code, NOT to return it. Log the stderr preview at WARN. Never put stderr in the response body.
8. On success, wrap the existing `_inspect_transform(raw_blob)` in `envelope.success("alerts.inspect", result_object)`.

### 6.3 bouncers/list.py

9. Mirror §6.1 — define `b_list_router = APIRouter(prefix="/bouncers", tags=["Bouncers"])` exported as `list_router`. Handler `GET ""`. `argv = ["bouncers","list","-o","json"]`. Transform preserved. Operation label `"bouncers.list"`. No query params (`limit` not supported by cscli `bouncers list`).

### 6.4 bouncers/inspect.py

10. Mirror §6.2 — `argv = ["bouncers","inspect",name,"-o","json"]`. Short-circuit + not-found by exit-code + stderr-scan (not exposed). Operation label `"bouncers.inspect"`.

### 6.5 Package __init__.py exports

11. `routers/alerts/__init__.py`: `from .list import list_router` and `from .inspect import inspect_router` (rename `inspect_router` from the prototype if needed).
12. `routers/bouncers/__init__.py`: same pattern.

## Interfaces/contracts and integration points

- `list_router` / `inspect_router` consumed by task-04 via `app.include_router(api)` under `/api/v1`.
- The `alert_id` path param is `int` — FastAPI's 422-on-bad-input → mapped to `invalid_parameters` by task-04's `RequestValidationError` handler. Acceptable.
- The existing `keyword/pattern` based `_flatten_alert` MUST stay byte-identical (frontend transforms assume the field shape).
- `app.state.runner` and `app.state.capabilities` MUST be set by task-04's lifespan at boot — handlers assume presence.

## Acceptance criteria

- `from routers.alerts import list_router, inspect_router` and `from routers.bouncers import list_router, inspect_router` import OK after migration.
- All 4 routes surface under the correct path + method after task-04 mounts them.
- `GET /api/v1/alerts?limit=5` returns `{operation:"alerts.list", result:[...]}` on success; `{operation:"alerts.list", error:{code:"unsupported"|"unavailable"|"crowdsec_failure"}}` on failure.
- `GET /api/v1/alerts/inspect/999` (existing-missing id) → `operation_error("alerts.inspect", NOT_FOUND)`.
- No response body contains `result.stderr` from cscli — verify with `grep -E 'return.*stderr|detail.*stderr' backend/routers/{alerts,bouncers}/*` → no matches.

## Verification commands/checks

From `backend/` after task-04 lands (or a manual `TestClient` harness if task-04 not yet ready):
- `uv run python -c "from routers.alerts import list_router, inspect_router; from routers.bouncers import list_router as b_list, inspect_router as b_inspect; print('import OK')"`.
- `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --port 8090 &` then:
  - `curl -s http://127.0.0.1:8090/api/v1/alerts | python -m json.tool` → envelope success OR op-error (if no cscli).
  - `curl -s http://127.0.0.1:8090/api/v1/bouncers | python -m json.tool` → same.
- `grep -nE 'detail=.*stderr\.decode\(\)|return.*stderr' backend/routers/alerts backend/routers/bouncers` → no matches.

## Explicit out-of-scope

- Editing `backend/main.py` (task-04).
- Editing `backend/routers/cscli.py` (task-02).
- Migrating decisions/machines/allowlists routers (task-07).
- Frontend (tasks 09/10).
- Tests/pytest (D12).
- Editing the source plan.

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
