"""Capabilities read-only route (plan §3.3).

GET /capabilities returns the cached startup probe map from app.state.
Never executes cscli at request time.
"""

from fastapi import APIRouter, Request

from envelope import CAPABILITIES_LIST, operation_error, success
from errors import UNSUPPORTED

router = APIRouter(prefix="/capabilities", tags=["Capabilities"])


@router.get("")
async def get_capabilities(request: Request):
    caps = getattr(request.app.state, "capabilities", None)
    if caps is None:
        return operation_error(CAPABILITIES_LIST, UNSUPPORTED)
    return success(CAPABILITIES_LIST, caps)