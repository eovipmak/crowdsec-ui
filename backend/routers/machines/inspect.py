import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, MACHINES_INSPECT
from errors import UNSUPPORTED, NOT_FOUND

_logger = logging.getLogger("cscli.machines")

inspect_router = APIRouter(prefix="/machines/inspect", tags=["Machines"])


@inspect_router.get("/{machine_id}")
async def inspect_machine(request: Request, machine_id: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("machines.inspect", {}).get("supported"):
        return operation_error(MACHINES_INSPECT, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["machines", "inspect", machine_id, "-o", "json"]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        stderr_text = result.stderr.decode(errors="replace").lower()
        if "doesn't exist" in stderr_text or "not found" in stderr_text:
            _logger.warning("cscli machines inspect not found: %s", result.stderr.decode(errors="replace")[:500])
            return operation_error(MACHINES_INSPECT, NOT_FOUND)
        code = classify_failure(result)
        _logger.warning("cscli machines inspect failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(MACHINES_INSPECT, code)

    machine = json.loads(result.stdout.decode())
    machine.pop("metrics", None)
    machine.pop("datasources", None)
    return success(MACHINES_INSPECT, machine)