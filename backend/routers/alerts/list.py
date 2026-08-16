import json
import logging
from fastapi import APIRouter, Query, Request

from ..cscli import CscliRunner, RunResult, classify_failure
from envelope import success, operation_error, ALERTS_LIST
from errors import UNSUPPORTED

_logger = logging.getLogger("cscli.alerts")

list_router = APIRouter(prefix="/alerts", tags=["Alerts"])


def extract_meta(alert):
    meta = {}

    for event in alert.get("events", []):
        for item in event.get("meta", []):
            meta[item["key"]] = item["value"]

    for item in alert.get("meta", []):
        meta[item["key"]] = item["value"]

    return meta


@list_router.get("")
async def list_alerts(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    scenario: str | None = Query(None),
    ip: str | None = Query(None),
):
    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("alerts.list", {}).get("supported"):
        return operation_error(ALERTS_LIST, UNSUPPORTED)

    runner: CscliRunner = request.app.state.runner
    argv = ["alerts", "list", "-m", "-l", str(limit), "-o", "json"]
    result = await runner.run(argv, timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        if result.stderr:
            _logger.warning("cscli alerts list stderr: %s", result.stderr.decode(errors="replace")[:500])
        return operation_error(ALERTS_LIST, code)

    raw_alerts = json.loads(result.stdout.decode()) if result.stdout else []
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
            "log_type": meta.get("log_type"),
            "service": meta.get("service"),
            "machine": meta.get("machine"),
        })

    # Filter (AND)
    if scenario:
        alerts = [a for a in alerts if a.get("scenario") == scenario]

    if ip:
        alerts = [a for a in alerts if a.get("source_ip") == ip]

    return success(ALERTS_LIST, alerts)