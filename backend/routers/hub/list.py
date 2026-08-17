import json
import logging
from typing import TypedDict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from envelope import HUB_LIST, success, operation_error, request_error
from errors import INVALID_PARAMETERS, MALFORMED_OUTPUT, UNSUPPORTED
from routers.cscli import CscliRunner, classify_failure

_logger = logging.getLogger("cscli.hub")
router = APIRouter(prefix="/hub", tags=["Hub"])


class HubItem(TypedDict, total=False):
    name: str
    description: str
    version: str
    latest_version: str
    status: str
    tainted: bool
    missing: bool
    type: str


@router.get("")
async def hub_list(request: Request):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get(HUB_LIST, {}).get("supported", False):
        return JSONResponse(content=operation_error(HUB_LIST, UNSUPPORTED))
    if request.query_params:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)
    runner: CscliRunner = request.app.state.runner
    result = await runner.run(["hub", "list", "-o", "json"], timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli hub list failed (code=%s): %s", code, result.stderr.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(HUB_LIST, code))
    if not result.stdout:
        parsed: dict = {}
    else:
        try:
            parsed = json.loads(result.stdout.decode())
        except json.JSONDecodeError:
            _logger.warning("cscli hub list malformed JSON: %s", result.stdout.decode(errors="replace")[:500])
            return JSONResponse(content=operation_error(HUB_LIST, MALFORMED_OUTPUT))
    return JSONResponse(content=success(HUB_LIST, parsed), headers={"Cache-Control": "no-store"})
