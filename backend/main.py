"""CrowdSec Dashboard API — entrypoint (task-04 rewrite).

Establishes the canonical /api/v1 prefix, wires the lifespan startup
(load config → resolve cscli path → CscliRunner → probe_capabilities →
app.state), mounts every Wave-2 read/status/capabilities router, installs
request-error envelope exception handlers, and mounts the static handler
LAST so /api/* never falls through.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from capabilities import probe_capabilities
from config import load_config, resolve_cscli_path
from envelope import health_ok, request_error
from routers.alerts import inspect_router as alerts_inspect, list_router as alerts_list
from routers.allowlists import (
    check_router as allowlists_check,
    inspect_router as allowlists_inspect,
    list_router as allowlists_list,
)
from routers.bouncers import inspect_router as bouncers_inspect, list_router as bouncers_list
from routers.capabilities import router as capabilities_router
from routers.cscli import CscliRunner
from routers.decisions import check_router as decisions_check, list_router as decisions_list
from routers.machines import inspect_router as machines_inspect, list_router as machines_list
from routers.metrics.show import router as metrics_router
from routers.hub.list import router as hub_router
from routers.status import router as status_router

import errors

logger = logging.getLogger("main")


def _resolve_config_path() -> str:
    """Locate the config file.

    Precedence: $DASHBOARD_CONFIG → ../config.yaml (repo root from backend/) →
    /etc/crowdsec-dashboard/config.yaml → "config.yaml" (defaults in load_config).
    """
    import os
    from pathlib import Path

    env = os.environ.get("DASHBOARD_CONFIG")
    if env:
        return env
    for candidate in (Path("../config.yaml"), Path("/etc/crowdsec-dashboard/config.yaml")):
        if candidate.exists():
            return str(candidate)
    return "config.yaml"


@asynccontextmanager
async def lifespan(app: FastAPI):
    cfg = load_config(_resolve_config_path())
    runner = CscliRunner(resolve_cscli_path(cfg), cfg.cscli_timeout_seconds)
    app.state.config = cfg
    app.state.runner = runner
    app.state.capabilities = await probe_capabilities(runner)
    try:
        from static import mount_static

        mount_static(app, cfg)
    except Exception:
        pass  # task-08 static serving not available (dev): silently skip
    yield


app = FastAPI(title="CrowdSec Dashboard API", version="1.0.0", lifespan=lifespan)

api = APIRouter(prefix="/api/v1")
api.include_router(alerts_list)
api.include_router(alerts_inspect)
api.include_router(bouncers_list)
api.include_router(bouncers_inspect)
api.include_router(decisions_list)
api.include_router(decisions_check)
api.include_router(machines_list)
api.include_router(machines_inspect)
api.include_router(allowlists_list)
api.include_router(allowlists_inspect)
api.include_router(allowlists_check)
api.include_router(status_router)
api.include_router(capabilities_router)
api.include_router(metrics_router)
api.include_router(hub_router)
app.include_router(api)


@app.get("/api/v1/health")
async def health():
    # Health sits directly on `app` at the literal /api/v1/health: it must stay
    # outside the router-prefix wrapper so it always resolves even before/without
    # the api router, and it returns a raw (non-envelope) payload by design.
    return health_ok()


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail and isinstance(detail["error"], dict):
        if "code" in detail["error"]:
            return JSONResponse(content=detail, status_code=exc.status_code)
    code = {
        404: errors.NOT_FOUND,
        405: errors.METHOD_NOT_ALLOWED,
        500: errors.INTERNAL,
    }.get(exc.status_code, errors.INTERNAL)
    body, status = request_error(code, status=exc.status_code)
    return JSONResponse(content=body, status_code=status)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # 422-on-bad-input maps to a safe 400 invalid_parameters envelope; never leak
    # field-level validation detail to clients.
    body, _ = request_error(errors.INVALID_PARAMETERS, status=400)
    return JSONResponse(content=body, status_code=400)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception processing %s", request.url, exc_info=exc)
    body, _ = request_error(errors.INTERNAL, status=500)
    return JSONResponse(content=body, status_code=500)
