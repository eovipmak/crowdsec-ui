# Task 01 — Envelope + capabilities probe for `simulation.status`

## Objective

Add the `simulation.status` operation label and startup capability probe so every later task has a stable contract to build against. Extends the envelope's canonical operation list from 15 → 16 probed ops (plus health) and adds Probe #6 (`cscli simulation status`, 5 s, text check) without touching any router or frontend file.

## Prerequisites/dependencies

- Wave 0. No other task in progress. Requires `backend/envelope.py`, `backend/capabilities.py`, `backend/errors.py`, `backend/routers/cscli.py` at post-`2026-08-17` state (hub + drilldown shipped). If those files are missing or have diverged, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/envelope.py` — add `SIMULATION_STATUS = "simulation.status"` constant; update module docstring operation list to include `simulation.status` (now 16 probed ops + health); keep existing labels (`HUB_LIST`, `METRICS_SHOW`, `ALERTS_LIST` … `CAPABILITIES_LIST`) unchanged.
- **MODIFY** `backend/capabilities.py` — add `SIMULATION_STATUS` to caps dict; add Probe #6 (`["simulation","status"]`, 5s, text check); wire caps dict to return 16 entries (`dict[str, {"supported": bool}]`). No router file.

Do NOT touch `backend/main.py` (task-03), `backend/routers/simulation/*` (task-02), or any `frontend/*` (tasks 04–05).

## Concrete implementation steps

1. `backend/envelope.py`:
   - Add after `HUB_LIST`: `SIMULATION_STATUS = "simulation.status"`.
   - Update the module docstring list of wire operations to include `simulation.status` (now 16 probed ops + health). Keep `health_ok()` / `success()` / `operation_error()` / `request_error()` unchanged.
2. `backend/capabilities.py`:
   - Import or define `SIMULATION_STATUS` — prefer `import envelope` and `envelope.SIMULATION_STATUS` to keep single source of truth.
   - Add `caps[envelope.SIMULATION_STATUS] = {"supported": False}` initialization alongside existing `STRUCTURED_READS`, status, metrics, and hub ops.
   - After Probe #5 (`hub list -o json`), add Probe #6:
     ```python
     result = await runner.run(["simulation", "status"], timeout=5.0)
     if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
         try:
             text = result.stdout.decode(errors="replace") if isinstance(result.stdout, (bytes, bytearray)) else (result.stdout or "")
             if "simulation" in text.lower():
                 caps[envelope.SIMULATION_STATUS] = {"supported": True}
             else:
                 _logger.warning("Probe #6: simulation status stdout missing 'simulation' marker; marking unsupported")
         except Exception:
             _logger.warning("Probe #6: simulation status probe decode failed; marking unsupported")
     else:
         _logger.warning("Probe #6 (simulation status) failed (exit_code=%d, exec_missing=%s, deadline_exceeded=%s)", result.exit_code, result.exec_missing, result.deadline_exceeded)
     ```
   - Keep `probe_capabilities(runner) -> dict[str, dict[str, bool]]` signature, return type, and existing probes #1–#5 identical. Do not mutate global state.
   - `GET /api/v1/capabilities` logic already returns `app.state.capabilities` verbatim — no change needed there, but now it will expose 16 keys.

## Interfaces/contracts and integration points

- `envelope.SIMULATION_STATUS` is the single source of truth consumed by `capabilities.py` and `backend/routers/simulation/status.py` (task-02). String value must be exactly `"simulation.status"`.
- `probe_capabilities()` is called once at startup by `backend/main.py:lifespan`. Result cached as `app.state.capabilities`; `GET /capabilities` returns it without invoking `cscli` at request time.
- Operation-level error codes reused: `unsupported` when probe fails; later router uses `crowdsec_failure`/`timeout`/`unavailable`/`permission_denied`/`malformed_output` via `classify_failure`.

## Acceptance criteria

- `backend/envelope.py` exports `SIMULATION_STATUS == "simulation.status"` alongside the existing labels.
- `backend/capabilities.py:probe_capabilities` includes Probe #6 exactly as `["simulation","status"]` with 5.0 s timeout, text check for `"simulation"` substring (case-insensitive), and WARN logging on failure.
- `probe_capabilities` returns 16 keys (11 STRUCTURED_READS + status.lapi + status.capi + metrics.show + hub.list + simulation.status) with `{"supported": bool}` values.
- Existing probes #1–#5 unchanged in argv/timeout/logging.
- `uv run python -c "import envelope; assert envelope.SIMULATION_STATUS=='simulation.status'"` passes.
- No new config key, no shell, no DB, no mutations.

## Verification commands/checks

From `backend/`:

- `grep -n "SIMULATION_STATUS" envelope.py capabilities.py` → both files mention the constant.
- `grep -n "simulation.*status" capabilities.py` → Probe #6 argv present.
- `uv run python -c "import envelope; print(envelope.SIMULATION_STATUS)"` → `simulation.status`.
- `uv run python -c "import asyncio; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; r=CscliRunner(None, 5.0); caps=asyncio.run(probe_capabilities(r)); assert len(caps)==16, len(caps); assert caps['simulation.status']=={'supported': False}; print('ok', len(caps))"` → degraded mode: 16 keys, `simulation.status` unsupported when cscli missing.
- With a real cscli present: `DASHBOARD_CONFIG=../config.yaml uv run python -c "import asyncio; from config import load_config, resolve_cscli_path; from capabilities import probe_capabilities; from routers.cscli import CscliRunner; cfg=load_config('../config.yaml'); r=CscliRunner(resolve_cscli_path(cfg), 5.0); caps=asyncio.run(probe_capabilities(r)); import json; print(json.dumps(caps, indent=2))"` → `simulation.status` true when `cscli simulation status` succeeds.
- `uv run python -m py_compile envelope.py capabilities.py` → no syntax errors.

## Reviewer

- `crowdsec-documentation-reviewer` (wire contract + probe correctness) + `crowdsec-command-mapper` secondary for argv/timeout invariants.

## Explicit out-of-scope

- Creating or modifying `backend/routers/simulation/*` (task-02).
- Wiring `main.py` router includes (task-03).
- Any frontend file (`frontend/src/lib/api/types.ts`, hooks, pages) (tasks 04–05).
- New config keys (`config.yaml`, `backend/config.py`) — no `simulation` section.
- Mutations (`simulation enable/disable`), DB, Docker/K8s, Prometheus `/metrics` text exposition, auth/session work.

## Coordinator status
- Status: completed
- Completed by: crowdsec-command-mapper
- Completed at: 2026-08-18T00:00:00Z
- Verification: `py_compile` green, `grep SIMULATION_STATUS` in both files, `probe_capabilities` returns 16 keys, degraded mode test OK (`simulation.status` unsupported when cscli missing)
- Commit or artifact reference: working tree

