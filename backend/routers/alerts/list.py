import json
import logging
import re
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from ..cscli import CscliRunner, RunResult, classify_failure
from envelope import success, operation_error, request_error, ALERTS_LIST
from errors import UNSUPPORTED, INVALID_PARAMETERS, MALFORMED_OUTPUT

_logger = logging.getLogger("cscli.alerts")

list_router = APIRouter(prefix="/alerts", tags=["Alerts"])

ALLOWED_KEYS = {"limit", "scenario", "ip", "since", "until", "scenario_contains", "offset"}
SINCE_UNTIL_MAX = 32
SCENARIO_CONTAINS_MAX = 64

# A1 validation (2026-08-19): `cscli alerts list --help` on target host shows
# --since/--until with Go duration (e.g. 4h, 30d). Server therefore passes
# through validated since/until to cscli (`--since`/`--until`) and uses
# server-side created_at fallback only when cscli lacks that support. Since
# the current host DOES support --since/--until, pass-through is enabled and
# fallback applies only when not passed through (or for ISO-8601 values that
# cscli may not interpret as duration).
CSCLI_SUPPORTS_SINCE_UNTIL = True


def _is_valid_since_until(v: str) -> bool:
    if len(v) > SINCE_UNTIL_MAX:
        return False
    if v.startswith("-"):
        return False
    if any(c in v for c in (";", "&", "|", "`", "$", "\n", "\r", "\x00")):
        return False
    # Try ISO-8601
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return True
    except (ValueError, TypeError):
        pass
    # Go duration: <number><unit> where unit is s, m, h, d
    if re.fullmatch(r"[0-9]+[smhd]", v):
        return True
    return False


def _parse_created_at(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _parse_since_until_bound(value: str | None) -> datetime | None:
    """Parse since/until query value for server-side comparison.

    Fallback prefers ISO-8601; duration form (e.g. 4h) is handled only as
    pass-through to cscli and returns None here so fallback filtering is
    skipped for duration bounds.
    """
    if not value or not isinstance(value, str):
        return None
    # Duration → pass-through only, no server-side datetime
    if re.fullmatch(r"[0-9]+[smhd]", value):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _matches_scenario_contains(scenario: str | None, needle: str | None) -> bool:
    if needle is None:
        return True
    return needle.lower() in (scenario or "").lower()


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
    since: str | None = Query(None),
    until: str | None = Query(None),
    scenario_contains: str | None = Query(None),
    offset: int = Query(0, ge=0, le=10000),
):
    # Unknown-key check (400 without spawn)
    keys = set(request.query_params.keys())
    if not keys <= ALLOWED_KEYS:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)

    # Duplicate-key check (400 without spawn)
    for key in keys:
        if len(request.query_params.getlist(key)) > 1:
            body, _ = request_error(INVALID_PARAMETERS)
            return JSONResponse(content=body, status_code=400)
    # Additional raw check: parse query_string to catch duplicates that
    # Starlette may have collapsed (defensive)
    raw_qs = request.scope.get("query_string", b"").decode()
    if raw_qs:
        seen: dict[str, int] = {}
        for part in raw_qs.split("&"):
            if not part:
                continue
            k = part.split("=", 1)[0]
            try:
                from urllib.parse import unquote
                k = unquote(k)
            except Exception:
                pass
            seen[k] = seen.get(k, 0) + 1
            if seen[k] > 1:
                body, _ = request_error(INVALID_PARAMETERS)
                return JSONResponse(content=body, status_code=400)

    # Field validation: scenario_contains
    if scenario_contains is not None:
        if scenario_contains == "":
            scenario_contains = None
        else:
            if len(scenario_contains) > SCENARIO_CONTAINS_MAX:
                body, _ = request_error(INVALID_PARAMETERS)
                return JSONResponse(content=body, status_code=400)
            if "\r" in scenario_contains or "\n" in scenario_contains or "\x00" in scenario_contains:
                body, _ = request_error(INVALID_PARAMETERS)
                return JSONResponse(content=body, status_code=400)
            if any(ord(c) < 32 for c in scenario_contains):
                body, _ = request_error(INVALID_PARAMETERS)
                return JSONResponse(content=body, status_code=400)

    # Field validation: since/until
    if since is not None:
        if len(since) > SINCE_UNTIL_MAX:
            body, _ = request_error(INVALID_PARAMETERS)
            return JSONResponse(content=body, status_code=400)
        if not _is_valid_since_until(since):
            body, _ = request_error(INVALID_PARAMETERS)
            return JSONResponse(content=body, status_code=400)
    if until is not None:
        if len(until) > SINCE_UNTIL_MAX:
            body, _ = request_error(INVALID_PARAMETERS)
            return JSONResponse(content=body, status_code=400)
        if not _is_valid_since_until(until):
            body, _ = request_error(INVALID_PARAMETERS)
            return JSONResponse(content=body, status_code=400)

    # Ordering check: since after until (only when both are ISO-8601 datetimes)
    if since is not None and until is not None:
        since_dt = _parse_since_until_bound(since)
        until_dt = _parse_since_until_bound(until)
        if since_dt is not None and until_dt is not None:
            if since_dt > until_dt:
                body, _ = request_error(INVALID_PARAMETERS)
                return JSONResponse(content=body, status_code=400)

    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get("alerts.list", {}).get("supported"):
        return JSONResponse(content=operation_error(ALERTS_LIST, UNSUPPORTED))

    # Build argv
    limit_for_cscli = min(100, limit + offset) if offset > 0 else limit
    argv = ["alerts", "list", "-m", "-l", str(limit_for_cscli), "-o", "json"]
    # Track whether we passed through to cscli (affects fallback)
    since_passed = False
    until_passed = False
    if CSCLI_SUPPORTS_SINCE_UNTIL:
        if since is not None:
            argv += ["--since", since]
            since_passed = True
        if until is not None:
            argv += ["--until", until]
            until_passed = True

    runner: CscliRunner = request.app.state.runner
    result = await runner.run(argv, timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        if result.stderr:
            _logger.warning("cscli alerts list stderr: %s", result.stderr.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(ALERTS_LIST, code))

    try:
        raw_alerts = json.loads(result.stdout.decode()) if result.stdout else []
    except json.JSONDecodeError:
        _logger.warning("cscli alerts list malformed JSON: %s", result.stdout.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(ALERTS_LIST, MALFORMED_OUTPUT))

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

    # Filter (AND) - exact scenario and ip (preserved)
    if scenario:
        alerts = [a for a in alerts if a.get("scenario") == scenario]

    if ip:
        alerts = [a for a in alerts if a.get("source_ip") == ip]

    # scenario_contains case-insensitive substring
    if scenario_contains is not None:
        alerts = [a for a in alerts if _matches_scenario_contains(a.get("scenario"), scenario_contains)]

    # since/until fallback — only when NOT passed through to cscli
    # When CSCLI supports --since/--until, cscli handles filtering; otherwise
    # fall back to server-side created_at filtering.
    if not CSCLI_SUPPORTS_SINCE_UNTIL:
        since_dt = _parse_since_until_bound(since) if since else None
        until_dt = _parse_since_until_bound(until) if until else None
        if since_dt is not None or until_dt is not None:
            filtered = []
            for a in alerts:
                created = _parse_created_at(a.get("created_at"))
                if created is None:
                    filtered.append(a)
                    continue
                if since_dt is not None and created < since_dt:
                    continue
                if until_dt is not None and created > until_dt:
                    continue
                filtered.append(a)
            alerts = filtered

    # Pagination: offset slice after all filters
    alerts = alerts[offset: offset + limit]

    return JSONResponse(content=success(ALERTS_LIST, alerts), headers={"Cache-Control": "no-store"})
