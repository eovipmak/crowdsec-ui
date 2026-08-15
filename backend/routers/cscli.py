"""cscli subprocess runner (plan §4 + task-02).

Production-grade CscliRunner replaces the legacy run_cscli helper.
Never spawns a shell; uses asyncio.create_subprocess_exec with positional argv.
Never leaks stderr into response bodies — callers use classify_failure + envelope.
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field

from fastapi import HTTPException

import errors

_logger = logging.getLogger("cscli")


@dataclass
class RunResult:
    """Outcome of a single cscli invocation."""

    exit_code: int
    stdout: bytes
    stderr: bytes
    deadline_exceeded: bool = False
    exec_missing: bool = False
    eacces: bool = False


class CscliRunner:
    """Async runner for cscli commands via asyncio.create_subprocess_exec.

    Args:
        executable_path: Resolved path to cscli binary, or None (every run()
            returns exec_missing without spawning).
        default_timeout: Fallback timeout in seconds when caller omits one.
    """

    def __init__(self, executable_path: str | None, default_timeout: float) -> None:
        self.executable_path = executable_path
        self.default_timeout = default_timeout

    async def run(
        self,
        argv: list[str],
        *,
        timeout: float | None = None,
        raise_on_missing: bool = False,
    ) -> RunResult:
        """Execute cscli with *argv* (sub-command + flags; executable prepended internally).

        Never uses shell=True or create_subprocess_shell.
        """
        if self.executable_path is None:
            if raise_on_missing:
                raise FileNotFoundError("cscli executable not configured")
            return RunResult(
                exit_code=-1,
                stdout=b"",
                stderr=b"",
                exec_missing=True,
            )

        effective_timeout = timeout if timeout is not None else self.default_timeout
        cmd = [self.executable_path, *argv]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            return RunResult(
                exit_code=-1, stdout=b"", stderr=b"", exec_missing=True
            )
        except PermissionError:
            return RunResult(
                exit_code=-1, stdout=b"", stderr=b"", eacces=True
            )

        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=effective_timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return RunResult(
                exit_code=-1,
                stdout=b"",
                stderr=b"",
                deadline_exceeded=True,
            )

        return RunResult(
            exit_code=proc.returncode,
            stdout=stdout,
            stderr=stderr,
        )


def classify_failure(result: RunResult, *, malformed: bool = False) -> str:
    """Map a RunResult's failure mode to an operation-level error code (errors.*)."""
    if result.deadline_exceeded:
        return errors.TIMEOUT
    if result.exec_missing:
        return errors.UNAVAILABLE
    if result.eacces:
        return errors.PERMISSION_DENIED
    if malformed:
        return errors.MALFORMED_OUTPUT
    if result.exit_code != 0:
        return errors.CROWDSEC_FAILURE
    return errors.INTERNAL


# ---------------------------------------------------------------------------
# Backward-compat stub for existing routers that still import run_cscli.
# tasks 06/07 migrate callers to CscliRunner.run; task-04 can then delete
# this stub once all callers have migrated.
# ---------------------------------------------------------------------------

_default_runner: CscliRunner | None = None


def set_default_runner(r: CscliRunner) -> None:
    """Register a process-wide default runner (called by task-04 lifespan)."""
    global _default_runner
    _default_runner = r


def _get_fallback_runner() -> CscliRunner:
    """Build a lazy fallback runner using the probe-resolver fallback paths."""
    for path in ["/usr/bin/cscli", "/usr/local/bin/cscli", "/opt/crowdsec/bin/cscli"]:
        if os.path.isfile(path):
            return CscliRunner(path, 30.0)
    return CscliRunner(None, 30.0)


async def run_cscli(*args) -> bytes:
    """Legacy stub — preserves the old contract for un-migrated routers.

    On success: returns stdout bytes.
    On failure: raises HTTPException(500) with a GENERIC message — NEVER stderr.
    """
    runner = _default_runner or _get_fallback_runner()
    result = await runner.run(list(args))
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        raise HTTPException(status_code=500, detail="cscli invocation failed")
    return result.stdout
