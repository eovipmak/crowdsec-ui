import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, RunResult, classify_failure
from envelope import success, operation_error, BOUNCERS_INSPECT
from errors import UNSUPPORTED, NOT_FOUND

_logger = logging.getLogger("cscli.bouncers")

inspect_router = APIRouter(prefix="/bouncers/inspect", tags=["Bouncers"])


@inspect_router.get("/{name}")
async def inspect_bouncer(request: Request, name: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("bouncers.inspect", {}).get("supported"):
        return operation_error(BOUNCERS_INSPECT, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["bouncers", "inspect", name, "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        stderr_lower = result.stderr.decode(errors="replace").lower()
        if result.stderr:
            _logger.warning("cscli bouncers inspect stderr: %s", result.stderr.decode(errors="replace")[:500])
        if "not found" in stderr_lower:
            return operation_error(BOUNCERS_INSPECT, NOT_FOUND)
        code = classify_failure(result)
        return operation_error(BOUNCERS_INSPECT, code)

    data = json.loads(result.stdout.decode())
    return success(BOUNCERS_INSPECT, data)