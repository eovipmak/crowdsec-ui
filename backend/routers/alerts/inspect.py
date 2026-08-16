import json
import logging
import re
from fastapi import APIRouter, Request

from ..cscli import CscliRunner, RunResult, classify_failure
from envelope import success, operation_error, ALERTS_INSPECT
from errors import UNSUPPORTED, NOT_FOUND

_logger = logging.getLogger("cscli.alerts")

inspect_router = APIRouter(prefix="/alerts/inspect", tags=["Alerts"])

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


def _shorten_timestamp(value):
    if not isinstance(value, str) or not value:
        return value
    v = value.strip()
    v = re.sub(r"\.\d+", "", v)
    v = re.sub(r"\s*\+0000(\s*UTC)?$", "", v)
    v = re.sub(r"\s*UTC$", "", v)
    return v


def _shorten_alert_time(value):
    if not isinstance(value, str) or not value:
        return value
    return _shorten_timestamp(value)


def summarize_event(event):
    meta = {item["key"]: item["value"] for item in event.get("meta", [])}
    out = {key: meta.get(key) for key in EVENT_META_KEYS}
    ts = out.get("timestamp")
    if isinstance(ts, str) and ts:
        out["timestamp"] = _shorten_timestamp(ts)
    return out


@inspect_router.get("/{alert_id}")
async def inspect_alert(request: Request, alert_id: int):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("alerts.inspect", {}).get("supported"):
        return operation_error(ALERTS_INSPECT, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["alerts", "inspect", str(alert_id), "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        stderr_lower = result.stderr.decode(errors="replace").lower()
        if result.stderr:
            _logger.warning("cscli alerts inspect stderr: %s", result.stderr.decode(errors="replace")[:500])
        if "not found" in stderr_lower or "no alert" in stderr_lower or "doesn't exist" in stderr_lower:
            return operation_error(ALERTS_INSPECT, NOT_FOUND)
        code = classify_failure(result)
        return operation_error(ALERTS_INSPECT, code)

    alert = json.loads(result.stdout.decode())
    source = alert.get("source", {})

    return success(ALERTS_INSPECT, {
        "id": alert.get("id"),
        "scenario": alert.get("scenario"),
        "message": alert.get("message"),
        "events_count": alert.get("events_count"),
        "created_at": _shorten_alert_time(alert.get("created_at")),
        "start_at": _shorten_alert_time(alert.get("start_at")),
        "stop_at": _shorten_alert_time(alert.get("stop_at")),
        "source_ip": source.get("ip"),
        "country": source.get("cn"),
        "as_name": source.get("as_name"),
        "remediation": alert.get("remediation"),
        "decisions": alert.get("decisions"),
        "events": [summarize_event(event) for event in alert.get("events", [])],
    })