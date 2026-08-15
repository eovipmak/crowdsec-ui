# Task 01 — Backend foundation: pyproject, config, envelope, errors

## Objective

Establish the backend foundation for all later backend tasks: declare the remaining runtime dependency (`pyyaml`), implement the reduced YAML config loader (plan §8 — drop `auth`/`session`), and create the minimal envelope + error-code helper modules every later task imports. Also declare the canonical operation labels and route shapes (plan §3.3) as Python constants so downstream tasks do not drift.

## Prerequisites/dependencies

- Wave 0. No other task in progress.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/pyproject.toml` — add `pyyaml` to dependencies; relax `requires-python` to `>=3.12`.
- **CREATE** `backend/config.py` — Pydantic v2 `Config` model + `load_config(path) -> Config`.
- **CREATE** `backend/envelope.py` — `success(op, result)`, `operation_error(op, code, msg=None)`, `request_error(code, msg=None, status=400)`, `health_ok()`.
- **CREATE** `backend/errors.py` — error-code string constants + safe-message lookup table.
- **MODIFY** `backend/main.py` — TEMPORARY placeholder only: leave the existing prototype routers as-is for now (task-04 rewrites `main.py` fully); in this task, only add a top-level `from .config import Config  # noqa` placeholder import to confirm the module imports, and add one `@app.get("/api/v1/health")` route returning `{"status": "ok"}`. Do NOT add the `/api/v1` prefix to the existing routers yet — that is task-04.

Do NOT touch `backend/routers/cscli.py` (task-02) or any `backend/routers/<entity>/*` file (tasks 03/05/06/07). Do NOT touch `frontend/`.

## Concrete implementation steps

1. `backend/pyproject.toml`:
   - Add `"pyyaml>=6.0"` to `dependencies` (keep `fastapi[standard]`).
   - Change `requires-python = ">=3.12"` (from `>=3.14`) with a one-line comment explaining broader host compatibility.
2. `backend/errors.py`:
   - Module-level constants (string values must match the frontend's `frontend/src/lib/api/types.ts` exactly in task-09):
     ```python
     INVALID_PARAMETERS = "invalid_parameters"
     NOT_FOUND         = "not_found"
     METHOD_NOT_ALLOWED = "method_not_allowed"
     INTERNAL         = "internal"
     CROWDSEC_FAILURE = "crowdsec_failure"
     TIMEOUT          = "timeout"
     UNAVAILABLE      = "unavailable"
     PERMISSION_DENIED = "permission_denied"
     MALFORMED_OUTPUT = "malformed_output"
     UNSUPPORTED      = "unsupported"
     ```
   - `SAFE_MESSAGES: dict[str, str]` per plan §3.2 message column (request-level ones verbatim; operation-level ones generic, e.g. `"The CrowdSec command failed."`, `"The CrowdSec command timed out."`, `"The CrowdSec command is not available."`, `"CrowdSec denied permission to run the command."`, `"CrowdSec returned malformed output."`, `"This operation is not supported."`).
   - `def message_for(code: str) -> str` returning `SAFE_MESSAGES.get(code, "An unexpected error occurred.")`.
3. `backend/envelope.py`:
   - `def success(op: str, result: Any) -> dict` → `{"operation": op, "result": result}`.
   - `def operation_error(op: str, code: str, msg: str | None = None) -> dict` → `{"operation": op, "error": {"code": code, "message": msg or errors.message_for(code)}}`.
   - `def request_error(code: str, msg: str | None = None, status: int = 400)` → returns a tuple `(body, status)` where body = `{"error": {"code": code, "message": msg or errors.message_for(code)}}`. (Used by task-04's exception handlers; raising can be a small wrapper `raise_request_error(...)` defined here as `raise RequestError_tBD(...) OR HTTPException(status, body)` — for simplicity use FastAPI `HTTPException(status_code=status, detail=body)` and let task-04 install the request-error envelope handler.)
   - `def health_ok() -> dict` → `{"status": "ok"}`.
   - Operation label constants exported here too (or in a new tiny `backend/operations.py`) — listing all 15 wire operations (see `backend/envelope.py` docstring in §3.3). Place the labels in `envelope.py` to avoid a new file: `ALERTS_LIST = "alerts.list"`, `ALERTS_INSPECT = "alerts.inspect"`, `DECISIONS_LIST = "decisions.list"`, `DECISIONS_CHECK = "decisions.check"`, `MACHINES_LIST = "machines.list"`, `MACHINES_INSPECT = "machines.inspect"`, `BOUNCERS_LIST = "bouncers.list"`, `BOUNCERS_INSPECT = "bouncers.inspect"`, `ALLOWLISTS_LIST = "allowlists.list"`, `ALLOWLISTS_INSPECT = "allowlists.inspect"`, `ALLOWLISTS_CHECK = "allowlists.check"`, `STATUS_LAPI = "status.lapi"`, `STATUS_CAPI = "status.capi"`, `CAPABILITIES_LIST = "capabilities.list"`.
4. `backend/config.py`:
   - Pydantic v2 models with `extra="ignore"` (so legacy `auth`/`session` blocks are tolerated and ignored):
     - `ServerConfig`: `bind: str = "127.0.0.1"`, `port: int = 8090`, `static_dir: str | None = None`.
     - `CscliConfig`: `executable_path: str | None = None`, `timeout: str = "30s"`.
     - `LoggingConfig`: `level: str = "info"`, `format: str = "text"`, `output: str = "stderr"`.
     - `Config`: `server: ServerConfig`, `cscli: CscliConfig`, `logging: LoggingConfig`.
   - Validators:
     - `server.bind` ≠ `0.0.0.0` (raise `ValueError("server.bind 0.0.0.0 is not allowed; bind to loopback or a NIC IP")`).
     - `server.port` ≠ `8080` (raise `ValueError("server.port 8080 is reserved for CrowdSec LAPI")`).
     - `cscli.timeout` matches `^\d+s$`; parsed to int seconds; 1 ≤ seconds ≤ 120 (else `ValueError`). Expose a computed `cscli_timeout_seconds: int` property.
     - `logging.level` ∈ {debug, info, warn, error}; `logging.format` ∈ {text, json}; `logging.output` ∈ {stderr, stdout, "<path>"}.
   - `def load_config(path: Path | str) -> Config`:
     - Read YAML; if the file is missing, return a default `Config()` instance populated ONLY from model defaults (do NOT silently invent `executable_path` — leave it `None`; task-03's probe resolver fills it).
     - Pass the dict through `Config(**data)`.
   - `def resolve_cscli_path(cfg: Config) -> str | None`:
     - If `cfg.cscli.executable_path` set and the file exists → return it.
     - Else search the fallback list `["/usr/bin/cscli", "/usr/local/bin/cscli", "/opt/crowdsec/bin/cscli"]` in order; return the first existing one as `str`.
     - Else return `None` (probes will mark all ops `unsupported`).
   - Importing `backend/config.py` MUST NOT read any file (pure model + functions).
5. `backend/main.py` (minimal touch):
   - Keep the existing router imports + `app.include_router(...)` calls untouched.
   - Add `@app.get("/api/v1/health")` returning `envelope.health_ok()` (raw `{"status": "ok"}`, NOT inside the operation envelope — plan §3.1).
   - Add the placeholder `from .config import Config, load_config, resolve_cscli_path  # noqa: F401  # wired in task-04` at module scope.

## Interfaces/contracts and integration points

- `backend/config.load_config` + `resolve_cscli_path` consumed by task-03 (capabilities probe) and task-04 (lifespan startup). `CscliRunner` (task-02) takes the resolved path + `cfg.cscli_timeout_seconds` as constructor args.
- `backend/envelope.success/operation_error/request_error` consumed by every read handler (tasks 03/05/06/07) and the capabilities/status routers.
- `backend/errors` constants consumed by task-02 (`classify_failure` returns one of the operation-level codes) and task-04 (request-error exception handler maps FastAPI 422/404/405 to the right code).
- Operation label constants (in `envelope.py`) consumed by every handler — single source of truth, no string literals scattered in routes.

## Acceptance criteria

- `uv sync` (from `backend/`) green; `uv.lock` refreshed and contains `pyyaml`.
- `uv run python -c "from config import Config, load_config, resolve_cscli_path; print(load_config('../config.yaml'))"` runs without error when a valid `config.yaml` exists (plan §8). When the file is missing, `load_config` returns a default `Config()`.
- `uv run python -c "import errors; print(errors.message_for(errors.TIMEOUT))"` prints a non-empty safe message.
- `uv run python -c "import envelope; print(envelope.success('alerts.list', [])); print(envelope.operation_error('decisions.list', errors.UNAVAILABLE))"` prints both shapes correctly.
- Invalid configs raise `ValueError` with safe messages (no secret in the message): bind `0.0.0.0`, port `8080`, `timeout: 0s` or `121s`, `logging.level: bogus`.
- `GET /api/v1/health` (via `uvicorn`) returns `{"status":"ok"}` — verified after a quick manual boot in task-04; in THIS task, a `python -c` smoke is enough.

## Verification commands/checks

From `backend/`:
- `uv sync` → exits 0.
- `uv run python -c "from config import Config, load_config, resolve_cscli_path; assert resolve_cscli_path(Config()) is not None or resolve_cscli_path(Config()) is None"` → no error (just confirms the resolver runs).
- `uv run python -c "import errors, envelope; assert envelope.success('x', 1) == {'operation':'x','result':1}; assert errors.message_for('unknown') == 'An unexpected error occurred.'"` → green.
- `uv run python -c "from config import Config
try:
    Config(server={'bind':'0.0.0.0','port':8090}, cscli={'timeout':'30s'}, logging={})
    raise SystemExit('should have raised')
except ValueError as e:
    print('OK', e)"` → green.
- `uv run python -c "from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
r = c.get('/api/v1/health')
assert r.status_code == 200 and r.json() == {'status':'ok'}, (r.status_code, r.text)
print('OK')"` → green (uses `TestClient` for a single smoke assertion — NOT a pytest suite).

## Explicit out-of-scope

- Implementing or modifying the cscli runner (task-02).
- The capabilities probe, status routers, or any read migration (tasks 03/05/06/07).
- Rewriting `backend/main.py` for `/api/v1` prefix + lifespan wiring (task-04).
- Frontend (task-09 + task-10).
- Static serving (task-08).
- Tests/pytest (D12 — none exist).
- Editing deploy/docs (task-11).
- Editing the source plan.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper (via coordinator)
- Completed at: 2026-08-15T12:00:00Z
- Verification: `uv sync` green; `uv run python -c "import errors, envelope; ..."` prints correct shapes; `uv run python -c "from config import Config, load_config, resolve_cscli_path; ..."` returns default Config; invalid bind raises ValueError; TestClient GET /api/v1/health → 200 {"status":"ok"}
- Commit or artifact reference: working tree
