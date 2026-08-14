import json
from fastapi import APIRouter, HTTPException

from ..cscli import run_cscli

router = APIRouter(prefix="/machines/inspect", tags=["Machines"])


@router.get("/{machine_id}")
async def inspect_machine(machine_id: str):
    try:
        stdout = await run_cscli("machines", "inspect", machine_id, "-o", "json")
    except HTTPException as exc:
        # cscli báo "user doesn't exist" khi máy không tồn tại
        if "doesn't exist" in exc.detail or "not found" in exc.detail:
            raise HTTPException(status_code=404, detail="Machine not found")
        raise

    machine = json.loads(stdout)
    machine.pop("metrics", None)
    machine.pop("datasources", None)
    return machine