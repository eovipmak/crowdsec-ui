import json
from fastapi import APIRouter

from ..cscli import run_cscli

router = APIRouter(prefix="/alerts/inspect", tags=["Alerts"])

# Keys chính trong meta mỗi sự kiện được tóm tắt gọn, bỏ phần còn lại
EVENT_META_KEYS = [
    "timestamp",
    "log_type",
    "service",
    "machine",
    "source_ip",
    "target_user",
    "datasource_path",
]


def summarize_event(event):
    meta = {item["key"]: item["value"] for item in event.get("meta", [])}
    return {key: meta.get(key) for key in EVENT_META_KEYS}


@router.get("/{alert_id}")
async def inspect_alert(alert_id: int):
    stdout = await run_cscli("alerts", "inspect", str(alert_id), "-o", "json")

    alert = json.loads(stdout)
    source = alert.get("source", {})

    return {
        "id": alert.get("id"),
        "scenario": alert.get("scenario"),
        "message": alert.get("message"),
        "events_count": alert.get("events_count"),
        "created_at": alert.get("created_at"),
        "start_at": alert.get("start_at"),
        "stop_at": alert.get("stop_at"),
        "source_ip": source.get("ip"),
        "country": source.get("cn"),
        "as_name": source.get("as_name"),
        "remediation": alert.get("remediation"),
        "decisions": alert.get("decisions"),
        "events": [summarize_event(event) for event in alert.get("events", [])],
    }