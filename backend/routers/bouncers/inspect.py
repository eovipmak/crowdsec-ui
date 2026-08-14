import json
from fastapi import APIRouter, HTTPException

from ..cscli import run_cscli

router = APIRouter(prefix="/bouncers/inspect", tags=["Bouncers"])


@router.get("/{name}")
async def inspect_bouncer(name: str):
    try:
        stdout = await run_cscli("bouncers", "inspect", name, "-o", "json")
    except HTTPException as exc:
        # cscli báo "bouncer not found" khi bouncer không tồn tại
        if "not found" in exc.detail:
            raise HTTPException(status_code=404, detail="Bouncer not found")
        raise

    return json.loads(stdout)