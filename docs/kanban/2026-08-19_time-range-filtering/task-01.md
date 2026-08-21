# Task 01 — Backend: alerts time-range + search + pagination (`backend/routers/alerts/list.py`)

## Objective

Extend `GET /api/v1/alerts` (`alerts.list`) with `since`/`until` (ISO-8601 or `N[smhd]` duration, server-side `created_at` fallback when `cscli --since/--until` not available), substring `scenario_contains` (case-insensitive, never in argv), and `offset` pagination (server-side slice), plus strict unknown/duplicate query-key rejection (400 without spawn) — all without new operation label, probe, or config key.

## Prerequisites/dependencies

- Wave 1, no other task required to start — but **validate A1 before coding**: `cscli alerts list --help` on the target host to confirm whether `--since`/`--until` (or `--from`/`--to`) exist and what value format they accept. If they exist, plan pass-through; if not, use server-side `created_at` fallback only. If prerequisite files (`backend/routers/alerts/list.py`, `backend/routers/cscli.py`, `backend/envelope.py`, `backend/errors.py`) are missing or diverged, STOP and report blocker — do not guess.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer` (wire contract, 400 boundary) + `crowdsec-command-mapper` secondary (argv/no-shell)

## Exact files and artifacts to create or modify

- **MODIFY** `backend/routers/alerts/list.py` — the only file this task touches. Existing `list_alerts` handler, `extract_meta`, flatten, exact `scenario`/`ip` filters remain; add `since`/`until`/`scenario_contains`/`offset`, query-allowlist check, format validation, pass-through vs fallback, substring filter, offset slice.
- Do NOT touch `backend/routers/decisions/list.py` (task-02), any `frontend/*` (tasks 03–04), or `docs/*` (task-05). Do not add `backend/tests/`, new probe, or new envelope label.

## Concrete implementation steps

1. Add imports: `re`, `datetime` (`from datetime import datetime, timezone, timedelta`), and `from fastapi.responses import JSONResponse` (follow `metrics/show.py` pattern for 400/200 JSON envelopes). Keep `APIRouter`, `Query`, `Request`, `CscliRunner`, `classify_failure`, `success`, `operation_error`, `request_error`, `ALERTS_LIST`, `UNSUPPORTED`, `INVALID_PARAMETERS`, `MALFORMED_OUTPUT` usage consistent.
2. Define module constants:
   ```python
   ALLOWED_KEYS = {"limit", "scenario", "ip", "since", "until", "scenario_contains", "offset"}
   SINCE_UNTIL_MAX = 32
   SCENARIO_CONTAINS_MAX = 64
   ```
3. Add helpers (keep small, no new file):
   - `_is_valid_since_until(v: str) -> bool` — returns True if `len(v) <= 32`, `v` does not start with `-`, contains no shell metachars (`;`, `&`, `|`, `` ` ``, `$`, `\n`, `\r`, `\0`), and matches either ISO-8601 (try `datetime.fromisoformat(v.replace("Z","+00:00"))` success) or Go duration `re.fullmatch(r"[0-9]+[smhd]", v)`. Reject otherwise.
   - `_parse_created_at(value: str | None) -> datetime | None` — parse alert `created_at` with `Z→+00:00` coercion; on failure return None (caller keeps row).
   - `_parse_since_until_bound(value: str | None) -> datetime | None` — parse `since`/`until` query value to `datetime` for server-side comparison; for duration form, compute `now_utc - delta` (or reject duration for fallback and rely on pass-through only — choose one and document: prefer ISO-8601 for fallback; duration handled only as pass-through).
   - `_matches_scenario_contains(scenario: str | None, needle: str | None) -> bool` — `needle is None or needle.lower() in (scenario or "").lower()`.
4. Extend handler signature:
   ```python
   @list_router.get("")
   async def list_alerts(
       request: Request,
       limit: int = Query(50, ge=1, le=100),
       scenario: str | None = Query(None),
       ip: str | None = Query(None),
       since: str | None = Query(None),
       until: str | None = Query(None),
       scenario_contains: str | None = Query(None),
       offset: int = Query(0, ge=0, le=10000),
   ):
   ```
5. At top of handler, before capability gate and before spawn:
   - **Unknown-key check:** `keys = set(request.query_params.keys())` — if not `keys <= ALLOWED_KEYS`, return `JSONResponse(content=request_error(INVALID_PARAMETERS)[0], status_code=400)`.
   - **Duplicate-key check:** parse raw `request.scope.get("query_string", b"").decode()` or for each key check `len(request.query_params.get_list(key)) > 1` — if any duplicate, 400 without spawn.
   - **Field validation (all 400 without spawn):**
     - `scenario_contains` empty string → treat as None (cleared); else if `len > 64` or contains `\r`/`\n`/`\0` or control chars (`any(ord(c) < 32 for c in v)`) → 400.
     - `since`/`until` if present: if `len > 32` → 400; else if not `_is_valid_since_until(v)` → 400.
     - If both `since` and `until` are valid ISO-8601 datetimes, parse to `datetime` and if `since_dt > until_dt` → 400. (If either is duration form, skip ordering check or convert duration to datetime first.)
6. Capability gate: `caps = getattr(request.app.state, "capabilities", {})` — if `not caps.get("alerts.list", {}).get("supported")`, return `operation_error(ALERTS_LIST, UNSUPPORTED)` (HTTP 200, no spawn).
7. Build `argv`:
   - Base: `["alerts", "list", "-m", "-l", str(limit_for_cscli), "-o", "json"]` where `limit_for_cscli = min(100, limit + offset) if offset > 0 else limit`.
   - If A1 confirmed `--since`/`--until` supported and `since`/`until` passed validation, append `["--since", since]` / `["--until", until]` (strictly after validation; never append unvalidated input). Otherwise omit and rely on server-side fallback. Never append `scenario_contains` or `offset` to argv.
8. Execute: `runner: CscliRunner = request.app.state.runner` → `result = await runner.run(argv, timeout=runner.default_timeout)`. On `exec_missing`/`eacces`/`deadline_exceeded`/`exit_code != 0`, `code = classify_failure(result)` (with `malformed=False`), WARN log truncated stderr `result.stderr.decode(errors="replace")[:500]`, return `JSONResponse(content=operation_error(ALERTS_LIST, code))` (HTTP 200).
9. Parse stdout: `raw_alerts = json.loads(result.stdout.decode()) if result.stdout else []` — on `JSONDecodeError`, WARN log and return `JSONResponse(content=operation_error(ALERTS_LIST, MALFORMED_OUTPUT))` (HTTP 200) via `classify_failure(result, malformed=True)` or direct `MALFORMED_OUTPUT`.
10. Normalize: reuse existing `extract_meta` + flatten loop to build `alerts` list (id, scenario, message, source_ip, country, as_name, events_count, created_at, log_type, service, machine).
11. Apply filters in order (AND), after normalization:
    - Existing exact `scenario` and `ip` (keep).
    - `scenario_contains` substring (case-insensitive) on `alert.scenario`.
    - `since`/`until` fallback — only when NOT passed through to cscli: keep row unless `created_at` parses to datetime and is outside `[since_dt, until_dt]`; if `created_at` missing/malformed, keep row (do not drop).
12. Pagination: `alerts = alerts[offset: offset + limit]` (offset 0 default). Slice after all filters.
13. Return: `JSONResponse(content=success(ALERTS_LIST, alerts), headers={"Cache-Control": "no-store"})`.

## Interfaces/contracts and integration points

- Route: `GET /api/v1/alerts` on `list_router` (`prefix="/alerts"` fixed — no new prefix). Mounted by `backend/main.py` already.
- Operation label: `envelope.ALERTS_LIST == "alerts.list"` — reused, no new label.
- Success (HTTP 200): `{"operation":"alerts.list","result": Alert[]}` with `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8`.
- Operation errors (HTTP 200): `{"operation":"alerts.list","error":{"code": "...", "message": "..."}}` — codes `unsupported` (gate), `crowdsec_failure`, `timeout`, `unavailable`, `permission_denied`, `malformed_output` via `classify_failure`.
- Request errors (HTTP 400): `{"error":{"code":"invalid_parameters","message":"..."}}` — unknown/duplicate key, bad `since`/`until` format, `since` after `until`, overlong `scenario_contains`, bad `offset`.
- `since`/`until` only enter argv after strict 32-char + ISO-8601/duration regex + no `--` prefix validation. `scenario_contains`/`offset` never enter argv.

## Acceptance criteria

- `backend/routers/alerts/list.py` accepts `since`, `until`, `scenario_contains`, `offset` as optional query params with correct defaults and bounds (`limit 1..100`, `offset 0..10000`).
- Unknown query key → 400 `invalid_parameters` without `CscliRunner.run` call; duplicate query key → 400 without spawn; invalid `since`/`until` format, `since` after `until`, `scenario_contains` >64 or with control chars, `offset` out of bounds → 400 without spawn.
- Capability `alerts.list` unsupported → 200 `operation_error` with `unsupported`, no spawn.
- `CscliRunner.run` called strictly with positional `["alerts","list","-m","-l",str(limit_for_cscli),"-o","json"]` plus optional `["--since",since]`/`["--until",until]` only when validated and A1-supported; never with `scenario_contains`/`offset`.
- Server-side `scenario_contains` is case-insensitive substring on `scenario`; `since`/`until` fallback filters on `created_at` (keep on missing/malformed `created_at`); `offset` slices `alerts[offset:offset+limit]` after all filters.
- Existing exact `scenario`/`ip` + flatten (`extract_meta`, flattened alerts) untouched.
- Stderr WARN-logged truncated 500 chars, never in response body; success sets `Cache-Control: no-store`.
- `uv run python -m py_compile backend/routers/alerts/list.py` passes.

## Verification commands/checks

From `backend/`:

- `uv run python -m py_compile routers/alerts/list.py` → no syntax error.
- `grep -n "ALLOWED_KEYS\|scenario_contains\|since.*until\|offset" routers/alerts/list.py` → new params present.
- FastAPI `TestClient` contract (unknown/duplicate/validation without spawn):
  ```python
  from fastapi import FastAPI
  from unittest.mock import AsyncMock
  from routers.alerts.list import list_router
  from envelope import ALERTS_LIST
  from routers.cscli import CscliRunner
  app = FastAPI()
  mock_runner = AsyncMock(spec=CscliRunner)
  mock_runner.default_timeout = 5.0
  app.state.runner = mock_runner
  app.state.capabilities = {ALERTS_LIST: {"supported": True}}
  app.include_router(list_router, prefix="/api/v1")
  from fastapi.testclient import TestClient
  c = TestClient(app)
  assert c.get("/api/v1/alerts?limit=50&unknown=1").status_code == 400
  assert c.get("/api/v1/alerts?limit=50&limit=100").status_code == 400
  assert c.get("/api/v1/alerts?since=not-a-date").status_code == 400
  assert c.get("/api/v1/alerts?since=2026-08-20T00:00:00Z&until=2026-08-19T00:00:00Z").status_code == 400
  assert c.get("/api/v1/alerts?scenario_contains=" + "x"*65).status_code == 400
  assert c.get("/api/v1/alerts?offset=-1").status_code == 400
  # unsupported gate
  app2 = FastAPI(); app2.state.runner = mock_runner; app2.state.capabilities = {ALERTS_LIST: {"supported": False}}
  app2.include_router(list_router, prefix="/api/v1")
  assert TestClient(app2).get("/api/v1/alerts").json()["error"]["code"] == "unsupported"
  print("alerts contract OK")
  ```
- Live (with real cscli, after task completes): `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090` then:
  `curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50" | python3 -m json.tool | head -n 20`
  `curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&scenario_contains=ssh" | python3 -c "import sys,json; d=json.load(sys.stdin); assert all('ssh' in (a.get('scenario') or '').lower() for a in d['result']); print('contains ok')"`
  `curl -i -s "http://127.0.0.1:8090/api/v1/alerts?unknown=1" | head -n 1` → `400`

## Reviewer

- `crowdsec-documentation-reviewer` (envelope, error taxonomy, 400 boundary) + `crowdsec-command-mapper` (argv/no-shell, `since`/`until` strict validation).

## Explicit out-of-scope

- `backend/routers/decisions/list.py` (task-02) — do not edit.
- Any `frontend/*` (tasks 03–04) or `docs/*` (task-05).
- New operation label, new startup probe, new config key, new router file.
- `scenario_contains`/`offset` ever entering argv; shell, DB, Docker/K8s, Prometheus, mutations.

## Coordinator status

- Status: completed
- Completed by: coordinator
- Completed at: 2026-08-21T00:00:00Z
- Verification: py_compile routers/alerts/list.py OK; grep ALLOWED_KEYS/scenario_contains/since/offset hits 38 lines; TestClient contract - unknown 400, duplicate 400, bad since 400, since>until 400, scenario_contains>64 400, offset -1 400, unsupported 200 no-spawn, valid since argv pass-through, scenario_contains case-insensitive, offset pagination, fallback paths verified
- Commit or artifact reference: working tree (backend/routers/alerts/list.py)
