import json
import logging
from fastapi import APIRouter, Query, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, DECISIONS_LIST
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.decisions")

list_router = APIRouter(prefix="/decisions", tags=["Decisions"])


@list_router.get("")
async def get_decisions(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    decision_type: str | None = Query(None, alias="type"),
    ip: str | None = None,
):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("decisions.list", {}).get("supported"):
        return operation_error(DECISIONS_LIST, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["decisions", "list", "-l", str(limit), "-o", "json"]

    if decision_type:
        argv += ["-t", decision_type]

    if ip:
        argv += ["-i", ip]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli decisions list failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(DECISIONS_LIST, code)

    raw = json.loads(result.stdout.decode()) if result.stdout else []
    decisions = []

    for alert in raw:
        source = alert.get("source", {})
        dec = (alert.get("decisions") or [{}])[0]

        decisions.append({
            "id": alert.get("id"),
            "scenario": alert.get("scenario"),
            "message": alert.get("message"),
            "created_at": alert.get("created_at"),
            "source_ip": source.get("ip"),
            "country": source.get("cn"),
            "as_name": source.get("as_name"),
            "type": dec.get("type"),
            "value": dec.get("value"),
            "scope": dec.get("scope"),
            "duration": dec.get("duration"),
            "origin": dec.get("origin"),
            "simulated": dec.get("simulated"),
        })

    return success(DECISIONS_LIST, decisions)