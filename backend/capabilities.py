"""Startup capability probes (plan §4.1).

Runs once at startup via task-04's lifespan; never executes cscli at request
time.  Returns a fresh dict — does NOT mutate global state.
"""

import json
import logging

from routers.cscli import CscliRunner

_logger = logging.getLogger("cscli.capabilities")

# Operation list mirroring envelope.py labels
STRUCTURED_READS = [
    "alerts.list", "alerts.inspect",
    "decisions.list", "decisions.check",
    "machines.list", "machines.inspect",
    "bouncers.list", "bouncers.inspect",
    "allowlists.list", "allowlists.inspect", "allowlists.check",
]


async def probe_capabilities(runner: CscliRunner) -> dict[str, dict[str, bool]]:
    """Run startup probes and return a dict of {op: {"supported": bool}}."""
    # Initialize all ops as unsupported
    caps = {op: {"supported": False} for op in STRUCTURED_READS}
    caps["status.lapi"] = {"supported": False}
    caps["status.capi"] = {"supported": False}

    # Probe #1: structured reads (alerts list -o json -l 1, 5s timeout)
    result = await runner.run(["alerts", "list", "-o", "json", "-l", "1"], timeout=5.0)
    if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
        # Check if stdout is valid JSON or empty
        try:
            if result.stdout:
                json.loads(result.stdout)
            for op in STRUCTURED_READS:
                caps[op] = {"supported": True}
        except (json.JSONDecodeError, ValueError):
            _logger.warning("Probe #1: alerts list returned malformed JSON; marking structured reads unsupported")
    else:
        _logger.warning("Probe #1 failed (exit_code=%d, exec_missing=%s, deadline_exceeded=%s)",
                        result.exit_code, result.exec_missing, result.deadline_exceeded)

    # Probe #2: lapi status (5s timeout)
    result = await runner.run(["lapi", "status"], timeout=5.0)
    if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
        caps["status.lapi"] = {"supported": True}
    else:
        _logger.warning("Probe #2 (lapi status) failed")

    # Probe #3: capi status (5s timeout)
    result = await runner.run(["capi", "status"], timeout=5.0)
    if result.exit_code == 0 and not result.deadline_exceeded and not result.exec_missing:
        caps["status.capi"] = {"supported": True}
    else:
        _logger.warning("Probe #3 (capi status) failed")

    return caps