"""Status routers: /status/lapi and /status/capi (plan §3.3 + §5).

Both endpoints consult app.state.capabilities and short-circuit to
operation_error(op, UNSUPPORTED) when probed unsupported. Both log
result.stderr at WARN and NEVER include stderr in any response body.
"""

import logging
from fastapi import APIRouter, Request
from envelope import success, operation_error, STATUS_LAPI, STATUS_CAPI
from errors import UNSUPPORTED, TIMEOUT, UNAVAILABLE, PERMISSION_DENIED, CROWDSEC_FAILURE
from routers.cscli import CscliRunner, RunResult, classify_failure

_logger = logging.getLogger("cscli.status")

router = APIRouter(prefix="/status", tags=["Status"])


@router.get("/lapi")
async def status_lapi(request: Request):
    """GET /api/v1/status/lapi → {operation:"status.lapi", result:{healthy:bool}}"""
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("status.lapi", {}).get("supported"):
        return operation_error(STATUS_LAPI, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    result = await runner.run(["lapi", "status"], timeout=5.0)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning(
            "cscli lapi status failed (code=%s): %s",
            code,
            result.stderr.decode(errors="replace")[:200],
        )
        return operation_error(STATUS_LAPI, code)

    text = result.stdout.decode(errors="replace").lower()
    healthy = "successfully interact" in text
    return success(STATUS_LAPI, {"healthy": healthy})


@router.get("/capi")
async def status_capi(request: Request):
    """GET /api/v1/status/capi → {operation:"status.capi", result:{enabled:bool}}"""
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("status.capi", {}).get("supported"):
        return operation_error(STATUS_CAPI, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    result = await runner.run(["capi", "status"], timeout=5.0)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning(
            "cscli capi status failed (code=%s): %s",
            code,
            result.stderr.decode(errors="replace")[:200],
        )
        return operation_error(STATUS_CAPI, code)

    text = result.stdout.decode(errors="replace")
    enabled = text.strip() != ""
    return success(STATUS_CAPI, {"enabled": enabled})