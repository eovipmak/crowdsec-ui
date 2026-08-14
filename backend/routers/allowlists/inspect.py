import json
from fastapi import APIRouter, HTTPException

from ..cscli import run_cscli

router = APIRouter(prefix="/allowlists/inspect", tags=["Allowlists"])


@router.get("/{name}")
async def inspect_allowlist(name: str):
    allowlists = json.loads(await run_cscli("allowlists", "list", "-o", "json"))

    for a in allowlists:
        if a["name"] == name:
            return {
                "name": a["name"],
                "description": a["description"],
                "created_at": a["created_at"],
                "updated_at": a["updated_at"],
                "items": a.get("items", []),
            }

    raise HTTPException(status_code=404, detail="Allowlist not found")