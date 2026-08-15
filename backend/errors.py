"""Error-code string constants and safe-message lookup (plan §3.2).

String values are part of the wire contract and mirror
``frontend/src/lib/api/types.ts`` (task-09) exactly.
"""

# Request-level codes (HTTP 4xx/5xx).
INVALID_PARAMETERS = "invalid_parameters"
NOT_FOUND = "not_found"
METHOD_NOT_ALLOWED = "method_not_allowed"
INTERNAL = "internal"

# Operation-level codes (HTTP 200, always safe message).
CROWDSEC_FAILURE = "crowdsec_failure"
TIMEOUT = "timeout"
UNAVAILABLE = "unavailable"
PERMISSION_DENIED = "permission_denied"
MALFORMED_OUTPUT = "malformed_output"
UNSUPPORTED = "unsupported"

# Safe, user-facing messages. cscli stderr is NEVER returned to clients.
SAFE_MESSAGES: dict[str, str] = {
    INVALID_PARAMETERS: "The request parameters are invalid.",
    NOT_FOUND: "The requested resource was not found.",
    METHOD_NOT_ALLOWED: "This request method is not allowed.",
    INTERNAL: "An unexpected server error occurred.",
    CROWDSEC_FAILURE: "The CrowdSec command failed.",
    TIMEOUT: "The CrowdSec command timed out.",
    UNAVAILABLE: "The CrowdSec command is not available.",
    PERMISSION_DENIED: "CrowdSec denied permission to run the command.",
    MALFORMED_OUTPUT: "CrowdSec returned malformed output.",
    UNSUPPORTED: "This operation is not supported.",
}

DEFAULT_MESSAGE = "An unexpected error occurred."


def message_for(code: str) -> str:
    """Return the safe message for *code*, or the generic fallback."""
    return SAFE_MESSAGES.get(code, DEFAULT_MESSAGE)
