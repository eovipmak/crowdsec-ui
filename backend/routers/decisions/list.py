import json
from fastapi import APIRouter, Query

from ..cscli import run_cscli

router = APIRouter(prefix="/decisions", tags=["Decisions"])


@router.get("/")
async def get_decisions(
    limit: int = Query(5, ge=1, le=100),
    decision_type: str | None = Query(None, alias="type"),
    ip: str | None = None,
):
    cmd = ["decisions", "list", "-l", str(limit), "-o", "json"]

    if decision_type:
        cmd += ["-t", decision_type]

    if ip:
        cmd += ["-i", ip]

    stdout = await run_cscli(*cmd)
    raw = json.loads(stdout)
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

    return decisions