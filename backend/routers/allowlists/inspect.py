import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, ALLOWLISTS_INSPECT
from errors import UNSUPPORTED, CROWDSEC_FAILURE

_logger = logging.getLogger("cscli.allowlists")

inspect_router = APIRouter(prefix="/allowlists/inspect", tags=["Allowlists"])


@inspect_router.get("/{name}")
async def inspect_allowlist(request: Request, name: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("allowlists.inspect", {}).get("supported"):
        return operation_error(ALLOWLISTS_INSPECT, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["allowlists", "list", "-o", "json"]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli allowlists inspect failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(ALLOWLISTS_INSPECT, code)

    allowlists = json.loads(result.stdout.decode()) if result.stdout else []

    for a in allowlists:
        if a["name"] == name:
            return success(ALLOWLISTS_INSPECT, {
                "name": a["name"],
                "description": a["description"],
                "created_at": a["created_at"],
                "updated_at": a["updated_at"],
                "items": a.get("items", []),
            })

    return operation_error(ALLOWLISTS_INSPECT, CROWDSEC_FAILURE, msg="Allowlist not found")