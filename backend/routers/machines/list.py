import json
import logging
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, MACHINES_LIST
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.machines")

list_router = APIRouter(prefix="/machines", tags=["Machines"])


@list_router.get("")
async def get_machines(request: Request):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("machines.list", {}).get("supported"):
        return operation_error(MACHINES_LIST, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["machines", "list", "-o", "json"]

    result = await runner.run(argv, timeout=runner.default_timeout)
    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning("cscli machines list failed: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(MACHINES_LIST, code)

    machines = json.loads(result.stdout.decode()) if result.stdout else []

    items = [
        {
            "machine_id": m.get("machineId"),
            "ip_address": m.get("ipAddress"),
            "os": m.get("os"),
            "version": m.get("version"),
            "auth_type": m.get("auth_type"),
            "validated": m.get("isValidated"),
            "datasources": m.get("datasources"),
            "created_at": m.get("created_at"),
            "last_heartbeat": m.get("last_heartbeat"),
            "last_push": m.get("last_push"),
        }
        for m in machines
    ]

    return success(MACHINES_LIST, items)