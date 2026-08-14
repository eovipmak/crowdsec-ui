import json
from fastapi import APIRouter

from ..cscli import run_cscli

router = APIRouter(prefix="/machines", tags=["Machines"])


@router.get("/")
async def get_machines():
    stdout = await run_cscli("machines", "list", "-o", "json")
    machines = json.loads(stdout)

    return [
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