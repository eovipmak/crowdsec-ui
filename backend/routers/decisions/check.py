import json
from fastapi import APIRouter

from ..cscli import run_cscli

router = APIRouter(prefix="/decisions/check", tags=["Decisions"])


@router.get("/{ip}")
async def check_decision(ip: str):
    stdout = await run_cscli("decisions", "list", "-v", ip, "-o", "json")
    raw = json.loads(stdout)

    return [
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