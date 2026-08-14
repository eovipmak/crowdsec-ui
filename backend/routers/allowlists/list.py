import json
from fastapi import APIRouter

from ..cscli import run_cscli

router = APIRouter(prefix="/allowlists", tags=["Allowlists"])


@router.get("/")
async def get_allowlists():
    stdout = await run_cscli("allowlists", "list", "-o", "json")
    allowlists = json.loads(stdout)

    return [
        {
            "name": a["name"],
            "description": a["description"],
            "created_at": a["created_at"],
            "updated_at": a["updated_at"],
            "size": len(a.get("items", [])),
        }
        for a in allowlists
    ]