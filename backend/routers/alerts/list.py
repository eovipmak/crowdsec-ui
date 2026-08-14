import json
from fastapi import APIRouter, Query

from ..cscli import run_cscli

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def extract_meta(alert):
    meta = {}

    for event in alert.get("events", []):
        for item in event.get("meta", []):
            meta[item["key"]] = item["value"]

    for item in alert.get("meta", []):
        meta[item["key"]] = item["value"]

    return meta


@router.get("/")
async def get_alerts(
    limit: int = Query(5, ge=1, le=100),
    log_type: str | None = None,
    source_ip: str | None = None,
):
    stdout = await run_cscli(
        "alerts", "list", "-m", "-l", str(limit), "-o", "json"
    )

    raw_alerts = json.loads(stdout)
    alerts = []

    for alert in raw_alerts:
        meta = extract_meta(alert)
        source = alert.get("source", {})

        alerts.append({
            "id": alert.get("id"),
            "scenario": alert.get("scenario"),
            "message": alert.get("message"),
            "source_ip": source.get("ip"),
            "country": source.get("cn"),
            "as_name": source.get("as_name"),
            "events_count": alert.get("events_count"),
            "created_at": alert.get("created_at"),
            #"start_at": alert.get("start_at"),
            #"stop_at": alert.get("stop_at"),
            "log_type": meta.get("log_type"),
            "service": meta.get("service"),
            "machine": meta.get("machine"),
            #"target_user": meta.get("target_user"),
        })

    # Filter (AND)
    if log_type:
        alerts = [a for a in alerts if a["log_type"] == log_type]

    if source_ip:
        alerts = [a for a in alerts if a["source_ip"] == source_ip]

    return alerts