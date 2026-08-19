# Task 02 — Backend: decisions time-range + search + pagination (`backend/routers/decisions/list.py`)

## Objective

Mirror task-01 for `GET /api/v1/decisions` (`decisions.list`): add `since`/`until`, substring `scenario_contains`, and `offset` pagination with strict unknown/duplicate query-key rejection (400 without spawn), preserving existing `type` (alias) and `ip` handling, capability gate, and envelope semantics. No new label/probe/config.

## Prerequisites/dependencies

- Wave 1 — parallel with task-01 (no file overlap). Validate A1 (`cscli decisions list --help`) for `--since`/`--until` support before implementing pass-through. If `backend/routers/decisions/list.py`, `backend/routers/cscli.py`, `backend/envelope.py`, `backend/errors.py` missing/diverged, STOP and report blocker.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer` (wire contract) + `crowdsec-command-mapper` secondary (argv/no-shell)

## Exact files and artifacts to create or modify

- **MODIFY** `backend/routers/decisions/list.py` — only file this task touches. Keep existing `get_decisions` behavior (`limit`, `decision_type` alias `"type"`, `ip`, flatten decisions, `CscliRunner`, `classify_failure`, `success`/`operation_error`/`request_error`, `Cache-Control: no-store`).
- Do NOT touch `backend/routers/alerts/list.py` (task-01), any `frontend/*` (tasks 03–04), or `docs/*` (task-05).

## Concrete implementation steps

1. Add imports: `re`, `datetime` (`from datetime import datetime, timezone, timedelta`), `from fastapi.responses import JSONResponse`. Keep `APIRouter`, `Query`, `Request`, `CscliRunner`, `classify_failure`, `success`, `operation_error`, `request_error`, `DECISIONS_LIST`, `UNSUPPORTED`, `INVALID_PARAMETERS`, `MALFORMED_OUTPUT`.
2. Define:
   ```python
   ALLOWED_KEYS = {"limit", "type", "ip", "since", "until", "scenario_contains", "offset"}
   SINCE_UNTIL_MAX = 32
   SCENARIO_CONTAINS_MAX = 64
   ```
3. Add same helpers as task-01 (copy/adapt, keep naming consistent):
   - `_is_valid_since_until(v: str) -> bool` — `len<=32`, no leading `-`, no shell metachars (`; & | ` $ \n \r \0`), matches ISO-8601 (`datetime.fromisoformat(v.replace("Z","+00:00"))`) or `re.fullmatch(r"[0-9]+[smhd]", v)`.
   - `_parse_created_at(value: str | None) -> datetime | None`
   - `_parse_since_until_bound(value: str | None) -> datetime | None`
   - `_matches_scenario_contains(scenario: str | None, needle: str | None) -> bool`
4. Extend handler signature (preserve `decision_type` alias):
   ```python
   @list_router.get("")
   async def get_decisions(
       request: Request,
       limit: int = Query(50, ge=1, le=100),
       decision_type: str | None = Query(None, alias="type"),
       ip: str | None = None,
       since: str | None = Query(None),
       until: str | None = Query(None),
       scenario_contains: str | None = Query(None),
       offset: int = Query(0, ge=0, le=10000),
   ):
   ```
   Note: `ip` currently has no `Query` alias — keep as-is if plan keeps it unannotated, or normalize to `Query(None)`; either preserves behavior but document choice. Prefer `ip: str | None = Query(None)` for symmetric validation.
5. At top, before gate/spawn (same order as task-01):
   - Unknown-key check: `keys = set(request.query_params.keys())` vs `ALLOWED_KEYS` → 400.
   - Duplicate-key check via `request.query_params.get_list(key)` or raw `scope["query_string"]` → 400.
   - `scenario_contains` empty→None; else `len>64` or control chars → 400.
   - `since`/`until` `len>32` or not `_is_valid_since_until` → 400; if both ISO datetimes and `since_dt > until_dt` → 400.
6. Capability gate: `if not caps.get("decisions.list", {}).get("supported")` → `operation_error(DECISIONS_LIST, UNSUPPORTED)` (200, no spawn).
7. Build `argv`:
   - Base: `["decisions", "list", "-l", str(limit_for_cscli), "-o", "json"]` with `limit_for_cscli = min(100, limit+offset) if offset>0 else limit`.
   - Append `["-t", decision_type]` if `decision_type`, `["-i", ip]` if `ip`.
   - Append `["--since", since]` / `["--until", until]` only when validated and A1-supported; otherwise omit (server-side fallback). Never `scenario_contains`/`offset`.
8. Execute `result = await runner.run(argv, timeout=runner.default_timeout)` → on failure, `classify_failure` + WARN truncated stderr + `operation_error(DECISIONS_LIST, code)` (200).
9. Parse stdout `raw = json.loads(result.stdout.decode()) if result.stdout else []` → `MALFORMED_OUTPUT` on `JSONDecodeError`.
10. Normalize: reuse existing flatten loop (source, `dec = (alert.get("decisions") or [{}])[0]`, fields `id, scenario, message, created_at, source_ip, country, as_name, type, value, scope, duration, origin, simulated`).
11. Filters (AND, after normalize):
    - keep existing `decision_type`/`ip` semantics already in argv or post-filter if needed.
    - `scenario_contains` case-insensitive on `decision["scenario"]` (which is `alert.get("scenario")`).
    - `since`/`until` fallback when not passed through: keep unless `created_at` parses and is outside bounds; missing/malformed `created_at` → keep.
12. Pagination: `decisions = decisions[offset: offset+limit]`.
13. Return `JSONResponse(content=success(DECISIONS_LIST, decisions), headers={"Cache-Control": "no-store"})`.

## Interfaces/contracts and integration points

- Route: `GET /api/v1/decisions` on `list_router` (`prefix="/decisions"`). No new prefix.
- Operation label: `envelope.DECISIONS_LIST == "decisions.list"` — reused.
- Success (200): `{"operation":"decisions.list","result": Decision[]}` with `Cache-Control: no-store`.
- Operation errors (200): `unsupported`, `crowdsec_failure`, `timeout`, `unavailable`, `permission_denied`, `malformed_output`.
- Request errors (400): `invalid_parameters` for unknown/duplicate/bad `since`/`until`/`scenario_contains`/`offset`.
- Only `since`/`until` ever enter argv (after strict validation); `scenario_contains`/`offset` server-side only.

## Acceptance criteria

- `GET /api/v1/decisions` accepts `since`, `until`, `scenario_contains`, `offset` with correct defaults/bounds; backward compat `?limit&type&ip` untouched.
- Unknown key → 400 without spawn; duplicate key → 400; invalid `since`/`until`, `since` after `until`, overlong `scenario_contains`, bad `offset` → 400.
- Unsupported capability → 200 `unsupported`, no spawn.
- `CscliRunner.run` argv is strictly allowlisted: base decisions list + optional `-t`/`-i` + optional validated `--since`/`--until`; never `scenario_contains`/`offset`.
- `scenario_contains` case-insensitive substring on `scenario`; `since`/`until` fallback on `created_at`; `offset` slice after all filters.
- Stderr never in response, `Cache-Control: no-store` on success, `py_compile` passes.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile routers/decisions/list.py` → no syntax error.
- `grep -n "ALLOWED_KEYS\|scenario_contains\|since.*until\|offset" routers/decisions/list.py` → new params present.
- FastAPI `TestClient` contract (same as task-01 but for decisions):
  ```python
  from fastapi import FastAPI
  from unittest.mock import AsyncMock
  from routers.decisions.list import list_router
  from envelope import DECISIONS_LIST
  from routers.cscli import CscliRunner
  app = FastAPI()
  m = AsyncMock(spec=CscliRunner); m.default_timeout = 5.0
  app.state.runner = m; app.state.capabilities = {DECISIONS_LIST: {"supported": True}}
  app.include_router(list_router, prefix="/api/v1")
  from fastapi.testclient import TestClient
  c = TestClient(app)
  assert c.get("/api/v1/decisions?limit=50&unknown=1").status_code == 400
  assert c.get("/api/v1/decisions?limit=50&limit=100").status_code == 400
  assert c.get("/api/v1/decisions?since=bad").status_code == 400
  assert c.get("/api/v1/decisions?scenario_contains=" + "x"*65).status_code == 400
  print("decisions contract OK")
  ```
- Live: `curl -s "http://127.0.0.1:8090/api/v1/decisions?limit=50&scenario_contains=ssh" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok', len(d['result']))"`

## Reviewer

- `crowdsec-documentation-reviewer` + `crowdsec-command-mapper` secondary.

## Explicit out-of-scope

- `backend/routers/alerts/list.py` (task-01), any `frontend/*` (tasks 03–04), `docs/*` (task-05), new label/probe/config, DB, Docker, Prometheus, mutations.

## Coordinator status

- Status: pending
