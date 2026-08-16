"""cscli subprocess runner (plan §4 + task-02).

Production-grade CscliRunner replaces the legacy run_cscli helper.
Never spawns a shell; uses asyncio.create_subprocess_exec with positional argv.
Never leaks stderr into response bodies — callers use classify_failure + envelope.
"""

import asyncio
import logging
from dataclasses import dataclass, field

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
