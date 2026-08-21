import json
import logging
import re
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from ..cscli import CscliRunner, classify_failure
from envelope import success, operation_error, request_error, DECISIONS_LIST
from errors import UNSUPPORTED, INVALID_PARAMETERS, MALFORMED_OUTPUT

_logger = logging.getLogger("cscli.decisions")

list_router = APIRouter(prefix="/decisions", tags=["Decisions"])

ALLOWED_KEYS = {"limit", "type", "ip", "since", "until", "scenario_contains", "offset"}
SINCE_UNTIL_MAX = 32
SCENARIO_CONTAINS_MAX = 64

# A1 validation (2026-08-19): `cscli decisions list --help` on target host shows
# --since/--until with Go duration (e.g. 4h, 30d). Server therefore passes
# through validated since/until to cscli (`--since`/`--until`) and uses
# server-side created_at fallback only when cscli lacks that support. Since
# the current host DOES support --since/--until, pass-through is enabled and
# fallback applies only when not passed through.
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


@list_router.get("")
async def get_decisions(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    decision_type: str | None = Query(None, alias="type"),
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
    if not caps.get("decisions.list", {}).get("supported"):
        return JSONResponse(content=operation_error(DECISIONS_LIST, UNSUPPORTED))

    # Build argv
    limit_for_cscli = min(100, limit + offset) if offset > 0 else limit
    argv = ["decisions", "list", "-l", str(limit_for_cscli), "-o", "json"]

    if decision_type:
        argv += ["-t", decision_type]

    if ip:
        argv += ["-i", ip]

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
            _logger.warning("cscli decisions list failed: %s", result.stderr.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(DECISIONS_LIST, code))

    try:
        raw = json.loads(result.stdout.decode()) if result.stdout else []
    except json.JSONDecodeError:
        _logger.warning("cscli decisions list malformed JSON: %s", result.stdout.decode(errors="replace")[:500])
        return JSONResponse(content=operation_error(DECISIONS_LIST, MALFORMED_OUTPUT))

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

    # Filters (AND) - scenario_contains case-insensitive substring
    if scenario_contains is not None:
        decisions = [d for d in decisions if _matches_scenario_contains(d.get("scenario"), scenario_contains)]

    # since/until fallback — only when NOT passed through to cscli
    # When CSCLI supports --since/--until, cscli handles filtering; otherwise
    # fall back to server-side created_at filtering.
    if not CSCLI_SUPPORTS_SINCE_UNTIL:
        since_dt = _parse_since_until_bound(since) if since else None
        until_dt = _parse_since_until_bound(until) if until else None
        if since_dt is not None or until_dt is not None:
            filtered = []
            for d in decisions:
                created = _parse_created_at(d.get("created_at"))
                if created is None:
                    filtered.append(d)
                    continue
                if since_dt is not None and created < since_dt:
                    continue
                if until_dt is not None and created > until_dt:
                    continue
                filtered.append(d)
            decisions = filtered

    # Pagination: offset slice after all filters
    decisions = decisions[offset: offset + limit]

    return JSONResponse(content=success(DECISIONS_LIST, decisions), headers={"Cache-Control": "no-store"})
