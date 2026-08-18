# Task 02 — Simulation router (`backend/routers/simulation/*`)

## Objective

Implement the `GET /api/v1/simulation` endpoint in `backend/routers/simulation/status.py`. Enforces capability gate (`simulation.status`), strict query validation (rejects any query params with 400 `invalid_parameters` without spawning subprocess), runs `cscli simulation status` via `CscliRunner`, parses stdout text into `{global, scenarios, raw}`, maps errors through `classify_failure`, truncates and logs stderr without returning it, and sets `Cache-Control: no-store`.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `backend/envelope.py:SIMULATION_STATUS` and `backend/capabilities.py` Probe #6. If either is missing, STOP, report the blocker, do not guess.
- Existing router patterns: `backend/routers/metrics/show.py` and `backend/routers/hub/list.py` for query validation, `CscliRunner` invocation, `classify_failure`, error envelopes, and logging.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer` (primary) + `crowdsec-command-mapper` (secondary)

## Exact files and artifacts to create or modify

- **CREATE** `backend/routers/simulation/__init__.py` — empty package marker.
- **CREATE** `backend/routers/simulation/status.py` — router with prefix `/simulation`, tags `["Simulation"]`, endpoint `GET ""`, validation, `CscliRunner` execution, text-parse normalization, and error classification.

Do NOT touch `backend/main.py` (task-03), `backend/capabilities.py` (task-01), or any `frontend/*` (tasks 04–05).

## Concrete implementation steps

1. `backend/routers/simulation/__init__.py`: create empty file.
2. `backend/routers/simulation/status.py`:
   - Define router: `router = APIRouter(prefix="/simulation", tags=["Simulation"])`.
   - Helper `parse_simulation_output(raw: str) -> dict`:
     - Input is `result.stdout.decode(errors="replace")` (or `""` if empty).
     - `raw` is the verbatim stdout string; also returned in the result.
     - `global` (bool): case-insensitive check — true if `raw.lower()` contains `"global simulation: enabled"` or `"simulation is enabled"` or (`"global:" in lower and "enabled" in lower and "simulation" in lower`). Otherwise false. Treat missing global line as false.
     - `scenarios` (list[str]): extract lines after a marker containing `"simulation enabled for"` (case-insensitive). For each subsequent non-empty line, strip leading `"- "`, `"* "`, `"• "`, and whitespace; keep values that contain `"/"` (e.g. `crowdsecurity/ssh-bf`, `custom/...`) or match `^[a-z0-9/_-]+$` with a slash. Ignore decorative lines, headers, and empty lines. Deduplicate preserving order.
     - Fallback: if no marker found but lines after global line look like scenario names (contain `/`), collect them as scenarios.
     - Return `{"global": bool, "scenarios": list[str], "raw": raw}`. Truncate `raw` to 4096 chars for safety if needed (but typical output is <1KB).
   - Query validator: check `request.query_params`; if any keys exist, return `JSONResponse(content=request_error(INVALID_PARAMETERS)[0], status_code=400)` — no cscli spawn. Duplicate keys are already surfaced as multi-value params; treat any presence as 400. Mirror `metrics/show.py` and `hub/list.py` pattern.
   - Endpoint `GET ""`:
     - Capability gate: `if not caps.get(SIMULATION_STATUS, {}).get("supported"): return JSONResponse(content=operation_error(SIMULATION_STATUS, UNSUPPORTED))` (HTTP 200).
     - Query rejection before gate or after — prefer before spawn (same as hub/metrics). If capabilities already gate, either order is fine but must be before `runner.run`.
     - Run `result = await runner.run(["simulation", "status"], timeout=runner.default_timeout)`.
     - On failure (`exec_missing`/`eacces`/`deadline_exceeded`/`exit_code != 0`): `code = classify_failure(result)` ; WARN log truncated stderr `result.stderr.decode(errors="replace")[:500]` ; return `JSONResponse(content=operation_error(SIMULATION_STATUS, code))` (HTTP 200). Use `MALFORMED_OUTPUT` only if stdout is expected but unparsable — but for text output, prefer defensive fallback over `malformed_output` (only use it if stdout is truly garbled and `raw` cannot be produced).
     - On success (`exit_code == 0`): `raw = result.stdout.decode(errors="replace") if result.stdout else ""` ; `parsed = parse_simulation_output(raw)` ; return `JSONResponse(content=success(SIMULATION_STATUS, parsed), headers={"Cache-Control": "no-store"})`. Set `Cache-Control: no-store` and ensure `Content-Type: application/json; charset=utf-8` via JSONResponse default.
   - Export `router`.

## Interfaces/contracts and integration points

- Path: mounted at `/api/v1/simulation` by `backend/main.py` (task-03).
- Operation label: `envelope.SIMULATION_STATUS` (`"simulation.status"`).
- Success envelope (HTTP 200): `{"operation": "simulation.status", "result": {"global": bool, "scenarios": string[], "raw": string}}`.
- Degraded / failure envelope (HTTP 200): `{"operation": "simulation.status", "error": {"code": "...", "message": "..."}}`.
- Request failure (unknown query param): `{"error": {"code": "invalid_parameters", "message": "..."}}` (HTTP 400).
- Response headers: `Cache-Control: no-store` on success.
- `raw` is stdout verbatim (not stderr); stderr is WARN-logged truncated and never returned.

## Acceptance criteria

- `backend/routers/simulation/__init__.py` and `backend/routers/simulation/status.py` exist and compile cleanly.
- `GET ""` on `/simulation` router checks `app.state.capabilities["simulation.status"]["supported"]` — unsupported returns operation_error HTTP 200 without spawning.
- Passing any query parameter (e.g. `?foo=bar` or `?x=1&x=2`) results in HTTP 400 `invalid_parameters` with NO `cscli` subprocess spawn.
- `CscliRunner.run` is called strictly with positional args `["simulation","status"]` (no shell, no mutations like `enable`/`disable`).
- Exit code failures, timeouts, and missing binary are mapped through `classify_failure`.
- Stderr is logged at WARN level truncated to 500 chars and is NEVER included in the HTTP response body (only stdout-derived `raw` on success).
- Success returns `success("simulation.status", {global, scenarios, raw})` with `Cache-Control: no-store`.
- Text parse is defensive: global-true only on explicit enabled markers; scenario extraction tolerates varying bullet/indentation; empty stdout yields `{global:false, scenarios:[], raw:""}`.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile routers/simulation/__init__.py routers/simulation/status.py` → no syntax errors.
- Test with FastAPI `TestClient`:
  ```python
  from fastapi import FastAPI
  from routers.simulation.status import router as sim_router, parse_simulation_output
  from envelope import SIMULATION_STATUS
  from routers.cscli import CscliRunner
  app = FastAPI()
  app.state.runner = CscliRunner(None, 5.0)
  app.state.capabilities = {SIMULATION_STATUS: {"supported": False}}
  app.include_router(sim_router, prefix="/api/v1")
  from fastapi.testclient import TestClient
  client = TestClient(app)
  r = client.get("/api/v1/simulation")
  assert r.status_code == 200 and r.json()["error"]["code"] == "unsupported"
  r = client.get("/api/v1/simulation?bad=1")
  assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_parameters"
  # parse unit check
  assert parse_simulation_output("global simulation: enabled\nsimulation enabled for scenarios:\n - crowdsecurity/ssh-bf")["global"] is True
  assert parse_simulation_output("global simulation: disabled")["global"] is False
  print("Router contract test OK")
  ```
  Run: `uv run python -c "<above script>"`.
- Live (with real cscli): `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090` then `curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -m json.tool` → operation envelope with global/scenarios/raw.

## Reviewer

- `crowdsec-documentation-reviewer` (envelope format, error taxonomy, query validation)
- `crowdsec-command-mapper` (subprocess security, no-shell invariant, argv safety)

## Explicit out-of-scope

- Modifying `backend/main.py` (task-03 wires the router).
- Any frontend files or hooks (tasks 04–05).
- Mutations (`simulation enable/disable`, `cscli simulation enable ...`).
- Adding new query parameters or POST body for log lines.
- Writing rules, parsers, or modifying CrowdSec configuration.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-18T00:00:00Z
- Verification: py_compile green, FastAPI TestClient contract test 5/5 PASS (unsupported 200, query rejection 400, global true/false parsing, empty output), extended edge-case suite all PASS (dedup, bullet variants, stderr truncation 500, classify_failure mapping)
- Commit or artifact reference: working tree

