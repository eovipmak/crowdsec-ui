"""Response envelope helpers (plan §3.1) + canonical operation labels (§3.3).

Wire contract (all responses JSON, ``Cache-Control: no-store``):

- success:         ``{"operation": <op>, "result": <data>}``          HTTP 200
- operation_error: ``{"operation": <op>, "error": {code, message}}``  HTTP 200
- request_error:   ``{"error": {code, message}}``                     HTTP 4xx/5xx
- health:          ``{"status": "ok"}`` (raw, OUTSIDE the envelope)   HTTP 200

The 16 wire routes of plan §3.3:

- ``/health`` — raw ``{"status": "ok"}``, no operation label
- ``capabilities.list``, ``alerts.list``, ``alerts.inspect``,
  ``decisions.list``, ``decisions.check``, ``machines.list``,
  ``machines.inspect``, ``bouncers.list``, ``bouncers.inspect``,
  ``allowlists.list``, ``allowlists.inspect``, ``allowlists.check``,
  ``status.lapi``, ``status.capi``, ``metrics.show``

The 15 operation-label constants below are the single source of truth;
handlers must reference them instead of hardcoding string literals.
"""

from typing import Any

import errors


def success(op: str, result: Any) -> dict:
    """Successful operation envelope (HTTP 200)."""
    return {"operation": op, "result": result}


def operation_error(op: str, code: str, msg: str | None = None) -> dict:
    """Operation-level failure envelope (HTTP 200). Message is always safe."""
    return {
        "operation": op,
        "error": {"code": code, "message": msg or errors.message_for(code)},
    }


def request_error(code: str, msg: str | None = None, status: int = 400) -> tuple[dict, int]:
    """Request-level failure envelope body + status (HTTP 4xx/5xx).

    Returns a ``(body, status)`` tuple for task-04's exception handlers.
    """
    body = {"error": {"code": code, "message": msg or errors.message_for(code)}}
    return body, status


def health_ok() -> dict:
    """Liveness payload — raw, outside the operation envelope (plan §3.1)."""
    return {"status": "ok"}


# Canonical operation labels (plan §3.3) — single source of truth.
METRICS_SHOW = "metrics.show"
ALERTS_LIST = "alerts.list"
ALERTS_INSPECT = "alerts.inspect"
DECISIONS_LIST = "decisions.list"
DECISIONS_CHECK = "decisions.check"
MACHINES_LIST = "machines.list"
MACHINES_INSPECT = "machines.inspect"
BOUNCERS_LIST = "bouncers.list"
BOUNCERS_INSPECT = "bouncers.inspect"
ALLOWLISTS_LIST = "allowlists.list"
ALLOWLISTS_INSPECT = "allowlists.inspect"
ALLOWLISTS_CHECK = "allowlists.check"
STATUS_LAPI = "status.lapi"
STATUS_CAPI = "status.capi"
CAPABILITIES_LIST = "capabilities.list"
