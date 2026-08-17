# Task 02 — Hub router (`backend/routers/hub/*`)

## Objective

Implement the `GET /api/v1/hub` (and optional `GET /api/v1/hub/types`) endpoint in `backend/routers/hub/list.py`. Enforces capability gate (`hub.list`), strict query validation (rejects any query params with 400 `invalid_parameters` without spawning subprocess), runs `cscli hub list -o json` via `CscliRunner`, normalizes output, maps errors through `classify_failure`, truncates and logs stderr without returning it, and sets `Cache-Control: no-store`.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `backend/envelope.py:HUB_LIST` and `backend/capabilities.py` Probe #5. If either is missing, STOP, report the blocker, do not guess.
- Existing router patterns: `backend/routers/metrics/show.py` and `backend/routers/cscli.py` for query validation, `CscliRunner` invocation, `classify_failure`, error envelopes, and logging.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer` (primary) + `crowdsec-command-mapper` (secondary)

## Exact files and artifacts to create or modify

- **CREATE** `backend/routers/hub/__init__.py` — empty package marker.
- **CREATE** `backend/routers/hub/list.py` — router with prefix `/hub`, tags `["Hub"]`, endpoint `GET ""` (and optional `GET "/types"`), validation, `CscliRunner` execution, response normalization, and error classification.

Do NOT touch `backend/main.py` (task-03), `backend/capabilities.py` (task-01), or any `frontend/*` (tasks 04–05).

## Concrete implementation steps

1. `backend/routers/hub/__init__.py`: create empty file.
2. `backend/routers/hub/list.py`:
   - Define router: `router = APIRouter(prefix="/hub", tags=["Hub"])`.
   - Define helper models / TypedDicts for typing:
     ```python
     class HubItem(TypedDict, total=False):
         name: str
         description: str
         version: str
         latest_version: str
         status: str
         tainted: bool
         missing: bool
         type: str
     ```
   - Implement query validator: check `request.query_params`; if any keys exist or duplicates are present, raise `HTTPException(status_code=400, detail={"error": {"code": "invalid_parameters", "message": "The request parameters are invalid."}})` or return `request_error("invalid_parameters")` with HTTP 400.
   - Endpoint `GET ""` (`hub_list`):
     - Check `request.app.state.capabilities.get(HUB_LIST, {}).get("supported", False)`. If false, return `operation_error(HUB_LIST, "unsupported")` (HTTP 200).
     - Run `result = await runner.run(["hub", "list", "-o", "json"])`.
     - Log truncated stderr if non-empty (`_logger.warning("cscli hub list stderr: %s", result.stderr[:500])`), but never include `result.stderr` in response.
     - If `result.exit_code != 0` or `result.deadline_exceeded` or `result.exec_missing`:
       - `code = classify_failure(result)`
       - Return `operation_error(HUB_LIST, code)` (HTTP 200).
     - Parse stdout:
       - If stdout is empty string `""`, treat as empty inventory `{"collections": [], "parsers": [], "scenarios": [], "postoverflows": []}`.
       - Parse `json.loads(result.stdout)`. If `JSONDecodeError`, return `operation_error(HUB_LIST, "malformed_output")`.
       - Normalize defensive payload: if stdout is a map containing type keys (`collections`, `parsers`, `scenarios`, `postoverflows`, etc.), return it under `result`. If it is a flat list, group by `type` or return keyed structure.
       - Return `success(HUB_LIST, normalized_data)` with header `Cache-Control: no-store`.
   - Export `router`.

## Interfaces/contracts and integration points

- Path: mounted at `/api/v1/hub` by `backend/main.py` (task-03).
- Operation label: `envelope.HUB_LIST` (`"hub.list"`).
- Success envelope: `{"operation": "hub.list", "result": {"collections": [...], "parsers": [...], "scenarios": [...], "postoverflows": [...]}}` (HTTP 200).
- Degraded / failure envelope: `{"operation": "hub.list", "error": {"code": "...", "message": "..."}}` (HTTP 200).
- Request failure (unknown query param): `{"error": {"code": "invalid_parameters", "message": "..."}}` (HTTP 400).
- Response headers: `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8`.

## Acceptance criteria

- `backend/routers/hub/__init__.py` and `backend/routers/hub/list.py` exist and compile cleanly.
- `GET ""` on `/hub` router checks `app.state.capabilities["hub.list"]["supported"]`.
- Passing any query parameter (e.g. `?foo=bar`) results in HTTP 400 `invalid_parameters` with NO `cscli` subprocess spawn.
- `CscliRunner.run` is called strictly with positional args `["hub", "list", "-o", "json"]` (no shell, no mutations).
- Exit code failures, timeouts, and missing binary are mapped through `classify_failure`.
- Malformed JSON stdout yields `operation_error("hub.list", "malformed_output")`.
- Stderr is logged at WARN level truncated to 500 characters and is NEVER included in the HTTP response body.
- Success returns `success("hub.list", ...)` with `Cache-Control: no-store`.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile routers/hub/__init__.py routers/hub/list.py` → no syntax errors.
- Test with FastAPI `TestClient`:
  ```python
  from fastapi import FastAPI
  from routers.hub.list import router as hub_router
  from envelope import HUB_LIST
  from routers.cscli import CscliRunner
  app = FastAPI()
  app.state.runner = CscliRunner(None, 5.0)
  app.state.capabilities = {HUB_LIST: {"supported": False}}
  app.include_router(hub_router, prefix="/api/v1")
  from fastapi.testclient import TestClient
  client = TestClient(app)
  # Unsupported probe state:
  r = client.get("/api/v1/hub")
  assert r.status_code == 200 and r.json()["error"]["code"] == "unsupported"
  # Invalid parameter check:
  r = client.get("/api/v1/hub?bad=1")
  assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_parameters"
  print("Router contract test OK")
  ```
  Run: `uv run python -c "<above script>"`.

## Reviewer

- `crowdsec-documentation-reviewer` (envelope format, error taxonomy, query validation)
- `crowdsec-command-mapper` (subprocess security, no-shell invariant, argv safety)

## Explicit out-of-scope

- Modifying `backend/main.py` (task-03 wires the router).
- Any frontend files or hooks (tasks 04–05).
- Mutations (`hub update`, `hub upgrade`, `collections install`, etc.).
- Adding new query parameters (e.g., search or filter — strict rejection of all query params).
- Writing rules, parsers, or modifying CrowdSec configuration.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-17T00:00:00Z
- Verification: `uv run python -m py_compile routers/hub/__init__.py routers/hub/list.py` passed; contract test verified capability gate, query param rejection, and response envelope.
- Commit or artifact reference: working tree
