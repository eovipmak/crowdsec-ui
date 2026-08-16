import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, DECISIONS_CHECK
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.decisions")

check_router = APIRouter(prefix="/decisions/check", tags=["Decisions"])


@check_router.get("/{ip}")
async def check_decision(request: Request, ip: str):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("decisions.check", {}).get("supported"):
        return operation_error(DECISIONS_CHECK, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["decisions", "list", "-v", ip, "-o", "json"]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli decisions check failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(DECISIONS_CHECK, code)

    raw = json.loads(result.stdout.decode()) if result.stdout else []

    items = [
        {
            "id": d.get("id"),
            "scope": d.get("scope"),
            "value": d.get("value"),
            "type": d.get("type"),
            "duration": d.get("duration"),
            "origin": d.get("origin"),
            "simulated": d.get("simulated"),
        }
        for alert in raw
        for d in alert.get("decisions", [])
    ]

    return success(DECISIONS_CHECK, items)