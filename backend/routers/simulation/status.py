import logging
import re

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from envelope import SIMULATION_STATUS, operation_error, request_error, success
from errors import INVALID_PARAMETERS, UNSUPPORTED
from routers.cscli import CscliRunner, classify_failure

_logger = logging.getLogger("cscli.simulation")
router = APIRouter(prefix="/simulation", tags=["Simulation"])


def parse_simulation_output(raw: str) -> dict:
    """Parse cscli simulation status text output into structured dict.

    Returns ``{"global": bool, "scenarios": list[str], "raw": str}``.
    ``raw`` is truncated to 4096 chars for safety.
    """
    if raw is None:
        raw = ""
    # Truncate raw for return value
    raw_truncated = raw[:4096] if len(raw) > 4096 else raw

    lower = raw.lower()
    global_enabled = False
    if "global simulation: enabled" in lower or "simulation is enabled" in lower or (
        "global:" in lower and "enabled" in lower and "simulation" in lower
    ):
        global_enabled = True

    scenarios: list[str] = []
    seen: set[str] = set()
    lines = raw.splitlines()

    # Find marker line containing "simulation enabled for" (case-insensitive)
    marker_idx = -1
    for i, line in enumerate(lines):
        if "simulation enabled for" in line.lower():
            marker_idx = i
            break

    def _clean_line(line: str) -> str | None:
        s = line.strip()
        if not s:
            return None
        # Strip leading bullet markers iteratively: "- ", "* ", "• ", "•"
        while True:
            if s.startswith("- "):
                s = s[2:].strip()
            elif s.startswith("* "):
                s = s[2:].strip()
            elif s.startswith("• "):
                s = s[2:].strip()
            elif s.startswith("•"):
                s = s[1:].strip()
            elif s.startswith("-") and len(s) > 1 and s[1] != " ":
                # handle "-crowdsecurity/..." without space
                s = s[1:].strip()
            else:
                break
            if not s:
                return None
        # Ignore decorative/header lines without a slash is the primary filter.
        # Keep values that contain "/" or match ^[a-z0-9/_-]+$ with a slash.
        if "/" not in s:
            return None
        # Strict pattern check: keep only if matches allowed chars (case-insensitive)
        # but still require "/" – decorative lines with "/" and spaces will already be filtered.
        # We allow the value even if it has dots? Spec says ^[a-z0-9/_-]+$ but we are lenient:
        # if it contains "/" we keep it; optionally validate chars.
        # To ignore headers like "--- scenarios ---" we already require "/" so fine.
        # Enforce allowed characters check to filter out lines with spaces/punctuation inside.
        # If the cleaned value contains spaces after bullet stripping, it's not a scenario.
        if " " in s or "\t" in s:
            return None
        # Optional regex gate – keep if matches, otherwise still keep if contains "/"
        # to tolerate e.g. "crowdsecurity/ssh-bf" which does match.
        # If it doesn't match allowed pattern, treat as decorative and drop if it has weird chars.
        if not re.fullmatch(r"[a-z0-9/_.-]+", s.lower()):
            # If it contains characters outside allowed set, drop it (defensive)
            # but still allow "/" is already required; we drop non-matching.
            return None
        return s

    if marker_idx != -1:
        for line in lines[marker_idx + 1 :]:
            cleaned = _clean_line(line)
            if cleaned is None:
                continue
            if cleaned not in seen:
                seen.add(cleaned)
                scenarios.append(cleaned)
    else:
        # Fallback: if no marker, collect lines after global line that look like scenarios
        global_idx = -1
        for i, line in enumerate(lines):
            ll = line.lower()
            if "global" in ll and "simulation" in ll:
                global_idx = i
                break
        start = global_idx + 1 if global_idx != -1 else 0
        for line in lines[start:]:
            cleaned = _clean_line(line)
            if cleaned is None:
                continue
            if cleaned not in seen:
                seen.add(cleaned)
                scenarios.append(cleaned)

    return {"global": global_enabled, "scenarios": scenarios, "raw": raw_truncated}


@router.get("")
async def simulation_status(request: Request):
    # Query validation: reject ANY query params with 400, no spawn
    if request.query_params:
        body, _ = request_error(INVALID_PARAMETERS)
        return JSONResponse(content=body, status_code=400)

    caps = getattr(request.app.state, "capabilities", {})
    if not caps.get(SIMULATION_STATUS, {}).get("supported"):
        return JSONResponse(content=operation_error(SIMULATION_STATUS, UNSUPPORTED))

    runner: CscliRunner = request.app.state.runner
    result = await runner.run(["simulation", "status"], timeout=runner.default_timeout)

    if result.exec_missing or result.eacces or result.deadline_exceeded or result.exit_code != 0:
        code = classify_failure(result)
        _logger.warning(
            "cscli simulation status failed (code=%s): %s",
            code,
            result.stderr.decode(errors="replace")[:500] if result.stderr else "",
        )
        return JSONResponse(content=operation_error(SIMULATION_STATUS, code))

    raw = result.stdout.decode(errors="replace") if result.stdout else ""
    parsed = parse_simulation_output(raw)
    return JSONResponse(
        content=success(SIMULATION_STATUS, parsed),
        headers={"Cache-Control": "no-store"},
    )
