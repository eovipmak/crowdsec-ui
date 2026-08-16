import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, ALLOWLISTS_LIST
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.allowlists")

list_router = APIRouter(prefix="/allowlists", tags=["Allowlists"])


@list_router.get("")
async def get_allowlists(request: Request):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("allowlists.list", {}).get("supported"):
        return operation_error(ALLOWLISTS_LIST, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["allowlists", "list", "-o", "json"]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli allowlists list failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(ALLOWLISTS_LIST, code)

    allowlists = json.loads(result.stdout.decode()) if result.stdout else []

    items = [
        {
            "name": a["name"],
            "description": a["description"],
            "created_at": a["created_at"],
            "updated_at": a["updated_at"],
            "size": len(a.get("items", [])),
        }
        for a in allowlists
    ]

    return success(ALLOWLISTS_LIST, items)