"""Static SPA serving: SPA fallback, cache headers, traversal guard (task-08).

Serves ``frontend/dist/`` from disk via a Starlette catch-all route appended
AFTER all ``/api/v1/*`` routes so API routes match first. GET/HEAD only,
``/api/*`` never falls through to static, ``assets/*`` get long-lived cache
headers, ``index.html`` and the SPA fallback are ``no-store``.
"""

import logging
from pathlib import Path

from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

import errors
from config import Config
from envelope import request_error

logger = logging.getLogger("static")

# Module global the handlers close over; set per call to mount_static.
STATIC_DIR: Path


def _not_found() -> JSONResponse:
    body, status = request_error(errors.NOT_FOUND, status=404)
    return JSONResponse(content=body, status_code=status)


def _method_not_allowed() -> JSONResponse:
    body, status = request_error(errors.METHOD_NOT_ALLOWED, status=405)
    return JSONResponse(content=body, status_code=status)


def _cache_headers(path: Path, captured_path: str, *, spa: bool) -> dict:
    if spa or path.name == "index.html":
        return {"Cache-Control": "no-store"}
    if captured_path.startswith("assets/"):
        return {"Cache-Control": "public, max-age=31536000, immutable"}
    return {"Cache-Control": "no-store"}


def _file_response(path: Path, captured_path: str, *, spa: bool = False) -> FileResponse:
    headers = _cache_headers(path, captured_path, spa=spa)
    return FileResponse(path, headers=headers, status_code=200)


async def _spa_fallback(request: Request):
    # ``/{path:path}`` captures with NO leading slash; be robust regardless.
    captured = request.path_params.get("path", "")

    # Never fall through to static for API paths.
    if request.url.path.startswith("/api/"):
        return _not_found()

    # Path-traversal guard.
    full = (STATIC_DIR / captured).resolve()
    try:
        full.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return _not_found()

    # Exact file.
    if full.is_file():
        return _file_response(full, captured)

    # .html fallback (e.g. /about -> about.html).
    alt = full.with_suffix(".html")
    if alt.is_file():
        return _file_response(alt, captured)

    # SPA fallback — 200 index.html, React Router owns client routes.
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return _file_response(index, f"path/{index.name}", spa=True)

    return _not_found()


async def _guarded(request: Request):
    # The catch-all handles every method; only GET/HEAD are allowed and the
    # rest get the request-error 405 envelope (not Starlette's default body).
    if request.method not in ("GET", "HEAD"):
        return _method_not_allowed()
    return await _spa_fallback(request)


def _resolve_static_dir(cfg: Config) -> Path:
    if cfg.server.static_dir:
        p = Path(cfg.server.static_dir)
        # Relative paths resolve against the backend working directory; made
        # absolute here so the existence check is consistent.
        return (p if p.is_absolute() else Path.cwd() / p).resolve()
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


def mount_static(app: FastAPI, cfg: Config) -> None:
    """Serve the SPA dist directory as the last-resort catch-all route.

    Appends (not inserts) the ``/{path:path}`` route as the LAST route so
    every previously-registered ``/api/v1/*`` route matches first. Non-fatal
    when the dist directory is missing.
    """
    global STATIC_DIR
    STATIC_DIR = _resolve_static_dir(cfg)

    if not STATIC_DIR.exists():
        logger.warning("static_dir not found: %s; SPA serving disabled", STATIC_DIR)
        return

    app.router.routes.append(
        Route(
            "/{path:path}",
            _guarded,
            methods=["GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        )
    )