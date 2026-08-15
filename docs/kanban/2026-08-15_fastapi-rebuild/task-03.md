# Task 03 — Capabilities module + `/capabilities` route

## Objective

Implement the startup-capability probe layer (plan §4.1) and the read-only `/api/v1/capabilities` route (plan §3.3). Probes run ONCE at startup, are cached in `app.state.capabilities`, and never execute cscli at request time. The route returns the map wrapped in `envelope.success("capabilities.list", {...})`.

This task ONLY builds the probe functions + the route registration; task-04 wires the lifespan startup that calls them.

## Prerequisites/dependencies

- task-01 COMPLETED (config + envelope + errors constants).
- task-02 COMPLETED (`CscliRunner`, `RunResult`, `classify_failure`).

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `backend/capabilities.py` — `probe_capabilities(runner) -> dict[str, dict[str, bool]]` + a `CapabilitiesRouter` builder.
- **CREATE** `backend/routers/capabilities.py` — the thin FastAPI router exposing `GET /capabilities`. (Router prefix is bare `/capabilities`; task-04 mounts everything under `/api/v1`.)

Do NOT touch `backend/main.py` (task-04 owns the wiring) or any read handler.

## Concrete implementation steps

1. `backend/capabilities.py`:
   - Operation list (single source of truth — mirror the labels from `envelope.py`):
     `STRUCTURED_READS = ["alerts.list","alerts.inspect","decisions.list","decisions.check","machines.list","machines.inspect","bouncers.list","bouncers.inspect","allowlists.list","allowlists.inspect","allowlists.check"]`
   - `async def probe_capabilities(runner: CscliRunner) -> dict[str, dict[str, bool]]`:
     - Initialize `caps = {op: {"supported": False} for op in STRUCTURED_READS + ["status.lapi", "status.capi"]}`.
     - **Probe #1** `await runner.run(["alerts","list","-o","json","-l","1"], timeout=5.0)`:
       - If `result.exit_code == 0` AND `result.stdout` parses as JSON (or is empty — plan §4 "empty stdout = []") → mark every op in `STRUCTURED_READS` as `{"supported": True}`. (Same probe → same command group, same JSON-shaped result family.)
       - Else mark `STRUCTURED_READS` all `{"supported": False}`.
     - **Probe #2** `await runner.run(["lapi","status"], timeout=5.0)`:
       - `caps["status.lapi"] = {"supported": result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing and result.exit_code == 0}`.
     - **Probe #3** `await runner.run(["capi","status"], timeout=5.0)`:
       - `caps["status.capi"] = {"supported": result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing}`.
     - Return `caps`.
2. `backend/routers/capabilities.py`:
   ```python
   from fastapi import APIRouter, Request
   from envelope import success, operation_error
   from errors import UNSUPPORTED
   router = APIRouter(prefix="/capabilities", tags=["Capabilities"])
   @router.get("")
   async def get_capabilities(request: Request):
       caps = getattr(request.app.state, "capabilities", None)
       if caps is None:
           return operation_error("capabilities.list", UNSUPPORTED)
       return success("capabilities.list", caps)
   ```
   (The empty-string path `GET ""` so the route is `/capabilities`; also accept `/capabilities/` via FastAPI's `redirect_slashes` default behavior.)

## Interfaces/contracts and integration points

- `probe_capabilities` is called by task-04's lifespan startup AFTER instantiating `CscliRunner`; the returned dict is stored at `app.state.capabilities`.
- `GET /capabilities` reads from `app.state.capabilities`; never runs cscli at request time. If the dict is missing (startup not yet done / failed), returns an op-failure envelope with `errors.UNSUPPORTED` (not `internal` — this is a graceful "not ready" signal).
- Tasks 06/07 read handlers SHOULD consult `app.state.capabilities` (via FastAPI `Request` dep or a small `Depends`) to short-circuit to `operation_error(op, UNSUPPORTED)` without invoking cscli when the op's probe returned `False`. Each of those tasks decides whether to inline the check or accept a `depends(app_state_caps)` helper — keep it simple; an inline check is fine.

## Acceptance criteria

- `probe_capabilities(runner)` returns a dict with exactly 13 keys (11 structured reads + `status.lapi` + `status.capi`), each `{"supported": bool}`.
- `GET /capabilities` returns `{"operation":"capabilities.list","result":{...13 ops...}}` with HTTP 200 when `app.state.capabilities` is set.
- When `app.state.capabilities` is unset, returns `{"operation":"capabilities.list","error":{"code":"unsupported","message":...}}` with HTTP 200.
- `probe_capabilities` does NOT mutate any global state; it returns a fresh dict.
- `uv run python -c "import asyncio; from routers.cscli import CscliRunner; from capabilities import probe_capabilities, STRUCTURED_READS; r=CscliRunner(None,5.0); caps=asyncio.run(probe_capabilities(r)); assert len(caps)==13 and all(v=={'supported':False} for v in caps.values()); print('OK')"` green (covers the "no cscli in dev" case: probe #1 fails → all structured reads `unsupported`; probes #2/#3 fail → `status.lapi`/`status.capi` `unsupported`).

## Verification commands/checks

From `backend/`:
- `uv run python -c "import capabilities, routers.capabilities; print('import OK')"` → green.
- `uv run python -c "import asyncio; from routers.cscli import CscliRunner; from capabilities import probe_capabilities; caps=asyncio.run(probe_capabilities(CscliRunner(None,5.0))); assert len(caps)==13; assert all(v['supported'] is False for v in caps.values()); print('no-cscli probe OK')"` → green.

## Explicit out-of-scope

- Wiring `app.state.capabilities` in `main.py` lifespan (task-04).
- Implementing any read handler/migration (tasks 06/07) or status routers (task-05).
- Editing the source plan.
- Tests/pytest (D12).

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
