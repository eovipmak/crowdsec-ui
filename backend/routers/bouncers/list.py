import json
from fastapi import APIRouter

from ..cscli import run_cscli

router = APIRouter(prefix="/bouncers", tags=["Bouncers"])


@router.get("/")
async def get_bouncers():
    stdout = await run_cscli("bouncers", "list", "-o", "json")
    bouncers = json.loads(stdout)

    return [
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