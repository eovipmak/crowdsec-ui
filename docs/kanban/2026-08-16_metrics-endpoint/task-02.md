# Task 02 — Metrics router (`GET /api/v1/metrics` + `GET /api/v1/metrics/{component}`)

## Objective

Implement the read-only metrics router that proxies `cscli metrics show [-o json]` through `CscliRunner`, with allowlist validation, `classify_failure` error mapping, JSON parsing, and enveloped responses. Expose `router: APIRouter(prefix="/metrics", tags=["Metrics"])` with two GET routes.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `backend/envelope.py:METRICS_SHOW` and `backend/capabilities.py`'s `metrics.show` capability key to gate the handler. If `METRICS_SHOW` is missing or `probe_capabilities` does not expose `metrics.show`, STOP, report the blocker, do not guess the contract.
- Requires `backend/routers/cscli.py:CscliRunner`, `RunResult`, `classify_failure` and `backend/envelope.py:success/operation_error`, `backend/errors.py` constants at current main state. If those drift, STOP.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer` (and `crowdsec-command-mapper` secondary for no-shell argv invariants)

## Exact files and artifacts to create or modify

- **CREATE** `backend/routers/metrics/__init__.py` — package marker (empty or re-export).
- **CREATE** `backend/routers/metrics/show.py` — the router file containing both GET handlers, `ALLOWLIST`, and `router`.

Do NOT touch `backend/envelope.py` / `backend/capabilities.py` (task-01 owns them), `backend/main.py` (task-03 owns `include_router`), `frontend/` (tasks 04–05), or docs (task-06). Do NOT add config keys.

## Concrete implementation steps

1. Create `backend/routers/metrics/__init__.py` — empty `__init__.py` is sufficient (optionally `from .show import router` but not required).
2. Implement `backend/routers/metrics/show.py` to satisfy the plan §5 contracts:
   ```python
   import json, logging
   from fastapi import APIRouter, Request
   from fastapi.responses import JSONResponse
   from ..cscli import CscliRunner, classify_failure
   from envelope import METRICS_SHOW, success, operation_error
   from errors import INVALID_PARAMETERS, UNSUPPORTED

   _logger = logging.getLogger("cscli.metrics")
   router = APIRouter(prefix="/metrics", tags=["Metrics"])

   ALLOWLIST: set[str] = {
       "acquisition","alerts","appsec-engine","appsec-rule","bouncers","decisions",
       "lapi","lapi-bouncer","lapi-decisions","lapi-machine","parsers","scenarios","stash","whitelists",
   }
   ```
3. Route: `GET ""` (mounted as `/api/v1/metrics` after task-03's prefix) and `GET "/{component}"`:
   - Check capability first (no cscli spawn on unsupported):
     ```python
     caps = getattr(request.app.state, "capabilities", {})
     if not caps.get(METRICS_SHOW, {}).get("supported"):
         return JSONResponse(content=operation_error(METRICS_SHOW, UNSUPPORTED))
     ```
   - For `GET "/{component}"`: validate `component in ALLOWLIST` exactly (case-sensitive, no alias); on miss return request-level 400:
     ```python
     from fastapi.responses import JSONResponse
     from envelope import request_error
     # invalid component
     body, status = request_error(INVALID_PARAMETERS)
     return JSONResponse(content=body, status_code=400)
     ```
     Do NOT call `cscli` on invalid input. Reject aliases (`engine`, `lapi`, `appsec`) with the same 400.
   - For `GET ""`: validate no unknown query keys and no duplicate query keys — any `request.query_params` present → 400 `invalid_parameters` (same rule as existing `limit` handlers). If the plan's "unknown query key → 400" is not straightforward via FastAPI validation, add an explicit guard: `if request.query_params: return JSONResponse(content=request_error(INVALID_PARAMETERS)[0], status_code=400)`.
   - Invoke cscli via runner (reuse `config.cscli_timeout_seconds` through `runner.default_timeout`):
     ```python
     runner: CscliRunner = request.app.state.runner
     argv = ["metrics","show","-o","json"]                  # for GET ""
     argv = ["metrics","show", component, "-o","json"]      # for GET "/{component}"
     result = await runner.run(argv, timeout=runner.default_timeout)
     ```
     Argv is positional — NEVER shell interpolation, NEVER `--url`/`--no-unit`, NEVER `-o human`.
   - On `result.exec_missing` / `eacces` / `deadline_exceeded` / `exit_code != 0`: map via `code = classify_failure(result)`, WARN-log truncated stderr (`result.stderr.decode(errors="replace")[:500]`), return `operation_error(METRICS_SHOW, code)` as `JSONResponse(content=..., status_code=200)`.
   - Success: parse `result.stdout`:
     - Empty stdout (`b""`) → `{}`. 
     - Otherwise `parsed = json.loads(result.stdout.decode())`; on `JSONDecodeError` → `operation_error(METRICS_SHOW, MALFORMED_OUTPUT)` (HTTP 200), WARN log.
     - Else `return JSONResponse(content=success(METRICS_SHOW, parsed))` with header `Cache-Control: no-store` (existing APIRouter middleware already sets it — otherwise set on response; verify in task-03).
   - Stderr is WARN-logged, NEVER placed in JSON.
4. Ensure the file has no `shell=True`, no `create_subprocess_shell`, no `os.system`, no `subprocess.run(shell=...)`.

## Interfaces/contracts and integration points

- Imports `envelope.METRICS_SHOW` as the single operation label (string `"metrics.show"`) — task-01 provides it.
- Uses `CscliRunner.run(argv)` from `backend/routers/cscli.py` (instantiated in `main.py:lifespan`, stored `app.state.runner`), with `app.state.capabilities` gate that matches every other read router (`alerts/list.py` shape).
- `classify_failure` maps `RunResult` to one of `crowdsec_failure` / `timeout` / `unavailable` / `permission_denied` / `malformed_output` / `internal` → `operation_error` at HTTP 200.
- Invalid `component` or unknown query key → request-level 400 `invalid_parameters` (no envelope `operation` field) — same as `INVALID_PARAMETERS` 400 in `envelope.request_error`.
- Success envelope: `{"operation":"metrics.show","result": <parsed JSON object>}` at HTTP 200, `Cache-Control: no-store`.
- `backend/main.py` (task-03) imports `from routers.metrics.show import router as metrics_router` and `api.include_router(metrics_router)` under `APIRouter(prefix="/api/v1")` before the static mount.

## Acceptance criteria

- `backend/routers/metrics/show.py` exists, exports `router: APIRouter(prefix="/metrics")` and `ALLOWLIST` with exactly the 14 canonical types (no aliases, see plan §5.2).
- `GET ""` invokes `["metrics","show","-o","json"]`; `GET "/{component}"` invokes `["metrics","show", component, "-o","json"]` with `component` validated before construction.
- Capability gate: when `app.state.capabilities["metrics.show"].supported == False`, both routes return `operation_error("metrics.show", "unsupported")` at HTTP 200 without spawning cscli.
- Invalid component (`foobar`, `engine`, `lapi`, `appsec`, `Acquisition`) → HTTP 400 `{"error":{"code":"invalid_parameters"}}` without spawning cscli.
- Unknown query key (`?unknown=1` or `?bad=1`) or duplicate query key on `GET /metrics` → HTTP 400 `invalid_parameters`.
- cscli failure modes (`exec_missing`, `eacces`, `deadline_exceeded`, `exit_code != 0`, `malformed JSON stdout`) each map to the correct operation-level code at HTTP 200; stderr appears only in WARN logs (≤500 chars), never in response body.
- Success returns `success("metrics.show", <parsed object>)` at HTTP 200; empty stdout → `result == {}`.
- No `shell=True` / `create_subprocess_shell` / `os.system` anywhere in the file.
- `uv run python -m py_compile backend/routers/metrics/show.py` passes.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile routers/metrics/show.py && echo ok`
- `grep -n "ALLOWLIST\|METRICS_SHOW" routers/metrics/show.py` → both present.
- `grep -nE 'shell=True|create_subprocess_shell|os\.system' routers/metrics/show.py || echo "ok no shell"`
- `grep -nE 'metrics.*show' routers/metrics/show.py` → both argv shapes present.
- Smoke with degraded cscli (no binary):
  ```bash
  uv run python -c "
  import asyncio
  from fastapi.testclient import TestClient
  from fastapi import FastAPI, APIRouter
  from envelope import METRICS_SHOW
  from routers.metrics.show import router as metrics_router, ALLOWLIST
  from routers.cscli import CscliRunner
  # minimal app mirroring main.py wiring
  from fastapi import FastAPI
  app = FastAPI()
  api = APIRouter(prefix='/api/v1')
  api.include_router(metrics_router)
  app.include_router(api)
  app.state.runner = CscliRunner(None, 30.0)
  app.state.capabilities = {METRICS_SHOW: {'supported': False}}
  c = TestClient(app)
  r = c.get('/api/v1/metrics'); assert r.status_code==200 and r.json()['error']['code']=='unsupported', r.text
  r = c.get('/api/v1/metrics/acquisition'); assert r.status_code==200 and r.json()['error']['code']=='unsupported', r.text
  print('unsupported gate ok')
  app.state.capabilities = {METRICS_SHOW: {'supported': True}}
  r = c.get('/api/v1/metrics/foobar'); assert r.status_code==400 and r.json()['error']['code']=='invalid_parameters', r.text
  r = c.get('/api/v1/metrics/engine'); assert r.status_code==400, r.text
  r = c.get('/api/v1/metrics?unknown=1'); assert r.status_code==400, r.text
  assert len(ALLOWLIST)==14
  print('validation ok')
  "
  ```
- Live cscli smoke (when binary present, after task-03 wiring):
  ```bash
  DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8091 &
  pid=$!; sleep 2
  curl -s http://127.0.0.1:8091/api/v1/metrics | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['operation']=='metrics.show' and isinstance(d['result'], dict); print('all ok')"
  curl -s http://127.0.0.1:8091/api/v1/metrics/acquisition | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'acquisition' in d['result']; print('filtered ok')"
  curl -i -s http://127.0.0.1:8091/api/v1/metrics/foobar | head -n 5  # → HTTP 400
  curl -i -s http://127.0.0.1:8091/api/v1/metrics | grep -i cache-control  # → no-store
  curl -s http://127.0.0.1:8091/api/v1/metrics/bad 2>&1 | grep -q "unknown metrics type" && echo "FAIL leak" || echo "ok no leak"
  kill $pid
  ```

## Reviewer

- `crowdsec-command-mapper` (argv allowlist + no-shell invariant + classify_failure mapping)
- `crowdsec-documentation-reviewer` (envelope + error-code + header invariants)

## Explicit out-of-scope

- Modifying `backend/main.py` to include the router (task-03).
- Modifying `backend/envelope.py` / `backend/capabilities.py` (task-01).
- Any frontend file (tasks 04–05).
- New config keys, Prometheus `/metrics` text exposition, Grafana, auth/session, DB, Docker/K8s.
- Alias expansion (`engine/lapi/appsec`) — reject with 400.

## Coordinator status
- Status: completed
- Completed by: muse-spark-1.2-contributor
- Completed at: 2026-08-17T09:36:43Z
- Verification summary: `uv run --directory backend python -m py_compile routers/metrics/show.py` ok; `grep ALLOWLIST|METRICS_SHOW` both present (ALLOWLIST len 14 exact canonical types, METRICS_SHOW used in both handlers); `grep shell=True|create_subprocess_shell|os.system` → ok no shell; `grep metrics.*show` both argv shapes `["metrics","show","-o","json"]` and `["metrics","show",component,"-o","json"]` present; degraded TestClient smoke (capability unsupported gate at HTTP 200, invalid component/alias case-sensitive 400 without spawn, unknown/duplicate query 400 without spawn, empty stdout → {}, valid JSON success with Cache-Control: no-store, exec_missing→unavailable/eacces→permission_denied/deadline_exceeded→timeout/exit_code→crowdsec_failure/malformed JSON→malformed_output all at HTTP 200 with WARN-truncated stderr and no stderr leak) all passed; prerequisite contracts verified (envelope.METRICS_SHOW=="metrics.show", capabilities Probe #4 `["metrics","show","acquisition","-o","json"]` 5s, CscliRunner/classify_failure shape matches current main)
- Commit or artifact reference: working tree (backend/routers/metrics/__init__.py empty package marker, backend/routers/metrics/show.py 84 lines — inspected, no rewrite needed)
