import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, RunResult, classify_failure
from envelope import success, operation_error, BOUNCERS_LIST
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.bouncers")

list_router = APIRouter(prefix="/bouncers", tags=["Bouncers"])


@list_router.get("")
async def list_bouncers(request: Request):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("bouncers.list", {}).get("supported"):
        return operation_error(BOUNCERS_LIST, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["bouncers", "list", "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        if result.stderr:
            _logger.warning("cscli bouncers list stderr: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(BOUNCERS_LIST, code)

    bouncers = json.loads(result.stdout.decode()) if result.stdout else []

    items = [
        {
            "name": b.get("name"),
            "type": b.get("type"),
            "auth_type": b.get("auth_type"),
            "os": b.get("os"),
            "version": b.get("version"),
            "ip_address": b.get("ip_address"),
            "revoked": b.get("revoked"),
            "auto_created": b.get("auto_created"),
            "created_at": b.get("created_at"),
            "last_pull": b.get("last_pull"),
        }
        for b in bouncers
    ]

    return success(BOUNCERS_LIST, items)