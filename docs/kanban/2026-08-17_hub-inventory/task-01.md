# Task 01 — Envelope + capabilities probe for `hub.list`

## Objective

Add the `hub.list` operation label and startup capability probe so every later task has a stable contract to build against. Extends the envelope's canonical operation list from 14 → 15 (excluding health) and adds Probe #5 (`cscli hub list -o json`, 5 s) without touching any router or frontend file.

## Prerequisites/dependencies

- Wave 0. No other task in progress. Requires `backend/envelope.py`, `backend/capabilities.py`, `backend/errors.py`, `backend/routers/cscli.py` at post-`2026-08-16_metrics-endpoint` state. If those files are missing or have diverged, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/envelope.py` — add `HUB_LIST = "hub.list"` constant; update module docstring operation list from 15 → 16 entries (health is not an operation) / 14 → 15 ops; keep existing 15 labels (`ALERTS_LIST` … `METRICS_SHOW`) unchanged.
- **MODIFY** `backend/capabilities.py` — add `HUB_LIST = "hub.list"` (or import `envelope.HUB_LIST`), add Probe #5, wire caps dict to return 15 entries (`dict[str, {"supported": bool}]`). No router file.

Do NOT touch `backend/main.py` (task-03), `backend/routers/hub/*` (task-02), or any `frontend/*` (tasks 04–05).

## Concrete implementation steps

1. `backend/envelope.py`:
   - Add after `METRICS_SHOW`: `HUB_LIST = "hub.list"`.
   - Update the module docstring list of wire operations to include `hub.list` (now 15 ops + health). Keep `health_ok()` / `success()` / `operation_error()` / `request_error()` unchanged.
2. `backend/capabilities.py`:
   - Import `envelope.HUB_LIST` (or define a local `HUB_LIST = "hub.list"` — prefer importing to maintain single source of truth).
   - Add `caps["hub.list"] = {"supported": False}` initialization alongside existing `STRUCTURED_READS`, status, and metrics ops.
   - After Probe #4 (`metrics show acquisition`), add Probe #5:
     ```python
     result = await runner.run(["hub", "list", "-o", "json"], timeout=5.0)
     if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
         try:
             if result.stdout:
                 json.loads(result.stdout)
             caps["hub.list"] = {"supported": True}
         except (json.JSONDecodeError, ValueError):
             _logger.warning("Probe #5: hub list returned malformed JSON; marking hub.list unsupported")
     else:
         _logger.warning("Probe #5 (hub list) failed (exit_code=%d, exec_missing=%s, deadline_exceeded=%s)", result.exit_code, result.exec_missing, result.deadline_exceeded)
     ```
   - Keep `probe_capabilities(runner) -> dict[str, dict[str, bool]]` signature, return type, and existing probes #1–#4 identical. Do not mutate global state.
   - `GET /api/v1/capabilities` logic already returns `app.state.capabilities` verbatim — no change needed there, but now it will expose 15 keys.

## Interfaces/contracts and integration points

- `envelope.HUB_LIST` is the single source of truth consumed by `capabilities.py` and `backend/routers/hub/list.py` (task-02). String value must be exactly `"hub.list"`.
- `probe_capabilities()` is called once at startup by `backend/main.py:lifespan` (task-03 wires the app). Result cached as `app.state.capabilities`; `GET /capabilities` returns it without invoking `cscli` at request time.
- Operation-level error codes reused: `unsupported` when probe fails; later router uses `crowdsec_failure`/`timeout`/`unavailable`/`permission_denied`/`malformed_output` via `classify_failure`.

## Acceptance criteria

- `backend/envelope.py` exports `HUB_LIST == "hub.list"` alongside the existing 15 labels.
- `backend/capabilities.py:probe_capabilities` includes Probe #5 exactly as `["hub", "list", "-o", "json"]` with 5.0 s timeout, JSON validation, and WARN logging on failure.
- `probe_capabilities` returns 15 keys (11 STRUCTURED_READS + status.lapi + status.capi + metrics.show + hub.list) with `{"supported": bool}` values.
- Existing probes #1–#4 unchanged in argv/timeout/logging.
- `uv run python -c "import envelope; assert envelope.HUB_LIST=='hub.list'"` passes.
- `uv run python -c "import capabilities; import inspect; assert 'hub.list' in inspect.getsource(capabilities.probe_capabilities)"` passes (probe present).
- No new config key, no shell, no DB, no mutations.

## Verification commands/checks

From `backend/`:

- `grep -n "HUB_LIST" envelope.py capabilities.py` → both files mention the constant.
- `grep -n "hub.*list.*json" capabilities.py` → Probe #5 argv present.
- `uv run python -c "import envelope; print(envelope.HUB_LIST)"` → `hub.list`.
- `uv run python -c "import asyncio, json; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; r=CscliRunner(None, 5.0); caps=asyncio.run(probe_capabilities(r)); assert len(caps)==15, len(caps); assert caps['hub.list']=={'supported': False}; print('ok', caps)"` → degraded mode: 15 keys, `hub.list` unsupported when cscli missing.
- With a real cscli present: `DASHBOARD_CONFIG=../config.yaml uv run python -c "import asyncio; from config import load_config, resolve_cscli_path; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; cfg=load_config('../config.yaml'); r=CscliRunner(resolve_cscli_path(cfg), 5.0); caps=asyncio.run(probe_capabilities(r)); import json; print(json.dumps(caps, indent=2))"` → `hub.list` true when `cscli hub list -o json` succeeds.
- `uv run python -m py_compile envelope.py capabilities.py` → no syntax errors.

## Reviewer

- `crowdsec-documentation-reviewer` (wire contract + probe correctness) + `crowdsec-command-mapper` secondary for argv/timeout invariants.

## Explicit out-of-scope

- Creating or modifying `backend/routers/hub/*` (task-02).
- Wiring `main.py` router includes (task-03).
- Any frontend file (`frontend/src/lib/api/types.ts`, hooks, pages) (tasks 04–05).
- New config keys (`config.yaml`, `backend/config.py`) — no `hub` section.
- Mutations (`hub update/upgrade`), DB, Docker/K8s, Prometheus `/metrics` text exposition, auth/session work.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-17T00:00:00Z
- Verification: `uv run python -m py_compile envelope.py capabilities.py` and `uv run python -c "import envelope; assert envelope.HUB_LIST=='hub.list'; ... assert len(caps)==15"` passed.
- Commit or artifact reference: working tree
