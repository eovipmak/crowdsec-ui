import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from envelope import METRICS_SHOW, success, operation_error, request_error
from errors import INVALID_PARAMETERS, MALFORMED_OUTPUT, UNSUPPORTED
from routers.cscli import CscliRunner, classify_failure

_logger = logging.getLogger("cscli.metrics")
router = APIRouter(prefix="/metrics", tags=["Metrics"])

ALLOWLIST: set[str] = {
    "acquisition",
    "alerts",
    "appsec-engine",
    "appsec-rule",
    "bouncers",
    "decisions",
    "lapi",
    "lapi-bouncer",
    "lapi-decisions",
    "lapi-machine",
    "parsers",
    "scenarios",
    "stash",
    "whitelists",
}


@router.get("")
async def show_metrics(request: Request):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get(METRICS_SHOW, {}).get("supported"):
        return JSONResponse(content=operation_error(METRICS_SHOW, UNSUPPORTED))
    if request.query_params:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)
    runner: CscliRunner = request.app.state.runner
    argv = ["metrics", "show", "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli metrics show failed (code=%s): %s", code, result.stderr.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(METRICS_SHOW, code))
    if not result.stdout:
        parsed: dict = {}
    else:
        try:
            parsed = json.loads(result.stdout.decode())
        except json.JSONDecodeError:
            _logger.warning("cscli metrics show malformed JSON: %s", result.stdout.decode(errors="replace")[:500])
            return JSONResponse(content=operation_error(METRICS_SHOW, MALFORMED_OUTPUT))
    return JSONResponse(content=success(METRICS_SHOW, parsed), headers={"Cache-Control": "no-store"})


@router.get("/{component}")
async def show_metrics_component(request: Request, component: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get(METRICS_SHOW, {}).get("supported"):
        return JSONResponse(content=operation_error(METRICS_SHOW, UNSUPPORTED))
    if request.query_params:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)
    if component not in ALLOWLIST:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)
    runner: CscliRunner = request.app.state.runner
    argv = ["metrics", "show", component, "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli metrics show %s failed (code=%s): %s", component, code, result.stderr.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(METRICS_SHOW, code))
    if not result.stdout:
        parsed: dict = {}
    else:
        try:
            parsed = json.loads(result.stdout.decode())
        except json.JSONDecodeError:
            _logger.warning("cscli metrics show %s malformed JSON: %s", component, result.stdout.decode(errors="replace")[:500])
            return JSONResponse(content=operation_error(METRICS_SHOW, MALFORMED_OUTPUT))
    return JSONResponse(content=success(METRICS_SHOW, parsed), headers={"Cache-Control": "no-store"})
