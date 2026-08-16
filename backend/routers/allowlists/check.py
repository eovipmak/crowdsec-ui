import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, ALLOWLISTS_CHECK
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.allowlists")

check_router = APIRouter(prefix="/allowlists/check", tags=["Allowlists"])


@check_router.get("/{ip}")
async def check_allowlist(request: Request, ip: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("allowlists.check", {}).get("supported"):
        return operation_error(ALLOWLISTS_CHECK, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["allowlists", "check", ip]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli allowlists check failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(ALLOWLISTS_CHECK, code)

    text = result.stdout.decode(errors="replace").lower()
    matched = "found" in text
    return success(ALLOWLISTS_CHECK, {"matched": matched})