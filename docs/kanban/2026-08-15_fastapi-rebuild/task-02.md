# Task 02 — cscli runner upgrade: CscliRunner + RunResult + classify_failure

## Objective

Replace the leaking `async run_cscli(*args)` helper in `backend/routers/cscli.py` with a production-grade `CscliRunner` class that: invokes `asyncio.create_subprocess_exec` with positional argv (NEVER a shell), enforces a per-command timeout, classifies failures into plan §3.2 operation-level codes, and exposes stderr ONLY through `RunResult.stderr` for logs. Callers (tasks 06/07 + the capabilities/status builds in tasks 03/05) wrap results in envelopes; the runner never returns HTTP errors.

## Prerequisites/dependencies

- task-01 COMPLETED (envelope + errors constants to consume).

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `backend/routers/cscli.py` — keep the module path/name (every existing router imports `from ..cscli import run_cscli` — see "Backward-compat stub" below), but ALSO expose `CscliRunner`, `RunResult`, `classify_failure`.

Do NOT touch `backend/main.py` (task-04 owns it), `backend/config.py`/`envelope.py`/`errors.py` (task-01 owns them), or any `backend/routers/<entity>/*` (tasks 06/07 own them).

## Concrete implementation steps

1. Define:
   ```python
   @dataclass
   class RunResult:
       exit_code: int
       stdout: bytes
       stderr: bytes
       deadline_exceeded: bool = False
       exec_missing: bool = False
       eacces: bool = False
   ```
2. `class CscliRunner`:
   - Constructor: `__init__(self, executable_path: str | None, default_timeout: float)`. Store both. If `executable_path is None`, every `run()` call returns a `RunResult(exec_missing=True)` immediately without exec — so the capabilities probe can mark all ops `unsupported`.
   - `async def run(self, argv: list[str], *, timeout: float | None = None, raise_on_missing: bool = False) -> RunResult`:
     - If `executable_path is None`: return `RunResult(exit_code=-1, stdout=b"", stderr=b"", exec_missing=True)`.
     - `argv` MUST be a list[str]; first element is a sub-command like `"alerts"`/`"decisions"`/`"lapi"`/`"capi"` (the executable path is prepended internally — the caller never passes it).
     - Use `proc = await asyncio.create_subprocess_exec(self.executable_path, *argv, stdout=PIPE, stderr=PIPE)` — NEVER `shell=True`, NEVER `asyncio.create_subprocess_shell`. Assert positional usage in code comments.
     - Wrap `await proc.communicate()` in `asyncio.wait_for(..., timeout=timeout or self.default_timeout)`.
     - On `asyncio.TimeoutError`: call `proc.kill()`, await `proc.wait()` to reap, return `RunResult(exit_code=-1, stdout=b"", stderr=b"", deadline_exceeded=True)`.
     - On `FileNotFoundError` during `create_subprocess_exec`: return `RunResult(exit_code=-1, stdout=b"", stderr=b"", exec_missing=True)`.
     - On `PermissionError`: return `RunResult(exit_code=-1, stdout=b"", stderr=b"", eacces=True)`.
     - Normal: return `RunResult(exit_code=proc.returncode, stdout=stdout, stderr=stderr)`.
3. `def classify_failure(result: RunResult, *, malformed: bool = False) -> str`:
   - If `result.deadline_exceeded` → `errors.TIMEOUT`.
   - If `result.exec_missing` → `errors.UNAVAILABLE`.
   - If `result.eacces` → `errors.PERMISSION_DENIED`.
   - If `malformed` → `errors.MALFORMED_OUTPUT`.
   - If `result.exit_code != 0` → `errors.CROWDSEC_FAILURE`.
   - Otherwise → `errors.INTERNAL` (defensive; should not happen for a failing run).
4. **Backward-compat stub**: keep a module-level function `async def run_cscli(*args)` that delegates to a process-wide default `CscliRunner` so the existing routers (before they migrate in tasks 06/07) don't break at import time. Concretely:
   ```python
   _default_runner: CscliRunner | None = None
   def set_default_runner(r: CscliRunner) -> None: ...
   async def run_cscli(*args) -> bytes:
       # legacy behavior preserved ONLY until tasks 06/07 migrate.
       # On success: return stdout bytes (matching the old contract).
       # On failure: raise HTTPException(500, detail="cscli invocation failed")  ← safe generic message, NEVER stderr.
       ...
   ```
   The legacy stub MUST NOT leak `stderr.decode()` (fix the current bug now). tasks 06/07 will stop using this stub and call `CscliRunner.run` directly; task-04 will wire the default runner at startup, and task-04 can then delete the legacy `run_cscli`/`set_default_runner` helpers if all callers have migrated (check before deleting).

## Interfaces/contracts and integration points

- `CscliRunner` is instantiated at app startup (task-04's lifespan) with `resolve_cscli_path(cfg)` + `cfg.cscli_timeout_seconds`. Stored in `app.state.runner`.
- Tasks 03/05/06/07 import `CscliRunner`, `RunResult`, `classify_failure` and build operation envelopes around `RunResult`.
- The runner never raises HTTP exceptions on cscli failure — it returns a `RunResult`; callers build the op-failure envelope via `envelope.operation_error(op, classify_failure(result))` and log `result.stderr` at WARN.
- The runner never returns `stderr` in any envelope — callers MUST not place `result.stderr` into response bodies.

## Acceptance criteria

- `CscliRunner.run` uses `asyncio.create_subprocess_exec` with positional argv; no `shell=True` anywhere in the module.
- Timeout path: `asyncio.TimeoutError` → `RunResult.deadline_exceeded=True`, `proc.kill()` invoked.
- `executable_path=None` → every `run()` returns `RunResult(exec_missing=True)` without spawning a process.
- `classify_failure` returns the correct `errors.*` constant for each branch.
- The legacy `run_cscli(*args)` stub no longer leaks `stderr.decode()` — on failure it raises a generic `HTTPException(status_code=500, detail="cscli invocation failed")`.
- `uv run python -c "import asyncio; from routers.cscli import CscliRunner, RunResult, classify_failure, run_cscli; r=CscliRunner(None, 5.0); res=asyncio.run(r.run(['alerts','list','-o','json'])); assert res.exec_missing; print('OK')"` green.

## Verification commands/checks

From `backend/`:
- `uv sync` → green (re-check; task-01 added `pyyaml`).
- `grep -nE 'subprocess_exec' backend/routers/cscli.py` → confirms exec (not shell) usage.
- `grep -nE 'shell=True|create_subprocess_shell' backend/routers/cscli.py` → no matches.
- `grep -nE "detail=stderr" backend/routers/cscli.py` → no matches (the leak is gone).
- `uv run python -c "import asyncio; from routers.cscli import CscliRunner; r=CscliRunner(None,5.0); res=asyncio.run(r.run(['x','y'])); assert res.exec_missing, res; print('OK')"` → green (covers the "no cscli installed" path that tasks 06/07 will hit during local dev).

## Explicit out-of-scope

- Writing any read handler or transform (tasks 06/07) or capabilities/status modules (tasks 03/05).
- Wiring `CscliRunner` into `app.state` (task-04).
- Editing `main.py` (task-04).
- Tests/pytest (D12).
- Removing the legacy stub final-cleanup (task-04 does final cleanup once all callers migrated).
- Editing the source plan.

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
