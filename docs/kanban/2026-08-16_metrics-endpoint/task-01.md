# Task 01 — Envelope + capabilities probe for `metrics.show`

## Objective

Add the `metrics.show` operation label and startup capability probe so every later task has a stable contract to build against. Extends the envelope's canonical operation list from 13 → 14 and adds Probe #4 (`cscli metrics show acquisition -o json`, 5 s) without touching any router or frontend file.

## Prerequisites/dependencies

- Wave 0. No other task in progress. Requires `backend/envelope.py`, `backend/capabilities.py`, `backend/errors.py`, `backend/routers/cscli.py` at the post-`2026-08-15_fastapi-rebuild` state (see `docs/kanban/2026-08-15_fastapi-rebuild/` tasks 01–04 completed). If those files are missing or have diverged, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/envelope.py` — add `METRICS_SHOW = "metrics.show"` constant; update module docstring operation list from 14 → now 15 entries (health is not an operation) / 13 → 14 ops; keep existing 14 labels (`ALERTS_LIST` … `CAPABILITIES_LIST`) unchanged.
- **MODIFY** `backend/capabilities.py` — add `METRICS_SHOW = "metrics.show"` (or reuse `envelope.METRICS_SHOW`), add Probe #4, wire caps dict to return 14 entries (`dict[str, {"supported": bool}]`). No router file.

Do NOT touch `backend/main.py` (task-03), `backend/routers/metrics/*` (task-02), or any `frontend/*` (tasks 04–05).

## Concrete implementation steps

1. `backend/envelope.py`:
   - Add after `CAPABILITIES_LIST`:`METRICS_SHOW = "metrics.show"`.
   - Update the module docstring list of wire operations to include `metrics.show` (now 14 ops + health). Keep `health_ok()` / `success()` / `operation_error()` / `request_error()` unchanged.
2. `backend/capabilities.py`:
   - Import `envelope.METRICS_SHOW` (or define a local `METRICS_SHOW = "metrics.show"` — but prefer importing to keep single source of truth).
   - Define `METRICS_OPS = ["metrics.show"]` or inline; add `caps["metrics.show"] = {"supported": False}` initialization alongside existing `STRUCTURED_READS` + `status.lapi`/`status.capi`.
   - After Probe #3 (`capi status`), add Probe #4:
     ```python
     result = await runner.run(["metrics", "show", "acquisition", "-o", "json"], timeout=5.0)
     if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
         try:
             if result.stdout:
                 json.loads(result.stdout)
             caps["metrics.show"] = {"supported": True}
         except (json.JSONDecodeError, ValueError):
             _logger.warning("Probe #4: metrics show acquisition returned malformed JSON; marking metrics.show unsupported")
     else:
         _logger.warning("Probe #4 (metrics show acquisition) failed (exit_code=%d, exec_missing=%s, deadline_exceeded=%s)", result.exit_code, result.exec_missing, result.deadline_exceeded)
     ```
   - Keep `probe_capabilities(runner) -> dict[str, dict[str,bool]]` signature, return type, and existing probes #1–#3 identical. Do not mutate global state.
   - `GET /api/v1/capabilities` logic already returns `app.state.capabilities` verbatim — no change needed there, but now it will expose 14 keys.

## Interfaces/contracts and integration points

- `envelope.METRICS_SHOW` is the single source of truth consumed by `capabilities.py` and `backend/routers/metrics/show.py` (task-02). String value must be exactly `"metrics.show"`.
- `probe_capabilities()` is called once at startup by `backend/main.py:lifespan` (task-03 wires it). Result cached as `app.state.capabilities`; `GET /capabilities` returns it without invoking `cscli` at request time.
- Operation-level error codes reused: `unsupported` when probe fails; later router uses `crowdsec_failure`/`timeout`/`unavailable`/`permission_denied`/`malformed_output` via `classify_failure`.

## Acceptance criteria

- `backend/envelope.py` exports `METRICS_SHOW == "metrics.show"` alongside the existing 14 labels.
- `backend/capabilities.py:probe_capabilities` includes Probe #4 exactly as `["metrics","show","acquisition","-o","json"]` with 5.0 s timeout, JSON validation, and WARN logging on failure.
- `probe_capabilities` returns 14 keys (11 STRUCTURED_READS + status.lapi + status.capi + metrics.show) with `{"supported": bool}` values.
- Existing probes #1–#3 unchanged in argv/timeout/logging.
- `uv run python -c "import envelope; assert envelope.METRICS_SHOW=='metrics.show'"` passes.
- `uv run python -c "import capabilities; import inspect; assert 'metrics.show' in inspect.getsource(capabilities.probe_capabilities)"` passes (probe present).
- No new config key, no shell, no DB, no Prometheus code.

## Verification commands/checks

From `backend/`:

- `grep -n "METRICS_SHOW" envelope.py capabilities.py` → both files mention the constant.
- `grep -n "metrics.*show.*acquisition" capabilities.py` → Probe #4 argv present.
- `uv run python -c "import envelope; print(envelope.METRICS_SHOW)"` → `metrics.show`.
- `uv run python -c "import asyncio, json; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; r=CscliRunner(None, 5.0); caps=asyncio.run(probe_capabilities(r)); assert len(caps)==14, len(caps); assert caps['metrics.show']=={'supported': False}; print('ok', caps)"` → degraded mode: 14 keys, `metrics.show` unsupported when cscli missing.
- With a real cscli present: `DASHBOARD_CONFIG=../config.yaml uv run python -c "import asyncio; from config import load_config, resolve_cscli_path; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; cfg=load_config('../config.yaml'); r=CscliRunner(resolve_cscli_path(cfg), 5.0); caps=asyncio.run(probe_capabilities(r)); import json; print(json.dumps(caps, indent=2))"` → `metrics.show` true when `cscli metrics show acquisition -o json` succeeds.
- `uv run python -m py_compile envelope.py capabilities.py` → no syntax errors.

## Reviewer

- `crowdsec-documentation-reviewer` (wire contract + probe correctness) + `crowdsec-command-mapper` secondary for argv/timeout invariants.

## Explicit out-of-scope

- Creating or modifying `backend/routers/metrics/*` (task-02).
- Wiring `main.py` router includes (task-03).
- Any frontend file (`frontend/src/lib/api/types.ts`, hooks, pages) (tasks 04–05).
- New config keys (`config.yaml`, `backend/config.py`) — no `metrics` section.
- Prometheus `/metrics` text exposition, Grafana, auth/session, DB, Docker/K8s work.
- Alias handling (`engine`, `lapi`, `appsec`) — canonical 14 types only (enforced in task-02).

## Coordinator status
- Status: completed
- Completed by: coordinator (direct — delegated agent hit turn limit before writing files)
- Completed at: 2026-08-16T20:35:00Z
- Verification: `uv run python -m py_compile backend/envelope.py backend/capabilities.py` ok; `METRICS_SHOW == "metrics.show"` ok; `grep METRICS_SHOW` hits both files; `grep metrics show acquisition` Probe #4 argv present; `asyncio probe_capabilities(CscliRunner(None))` → 14 keys with metrics.show unsupported when cscli missing
- Commit or artifact reference: working tree (backend/envelope.py, backend/capabilities.py)
