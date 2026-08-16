# Task 08 — Static serving: SPA fallback, cache headers, traversal guard

## Objective

Implement `backend/static.py` per plan §6 to serve `frontend/dist/` from disk: GET/HEAD-only (405 otherwise), exact-file match, `.html` fallback, SPA-fallback to `index.html`/200, path-traversal guard, `/api/*` non-fall-through, cache headers (`index.html` → `no-store`; `assets/*` → `public, max-age=31536000, immutable`; API JSON → `no-store`).

## Prerequisites/dependencies

- task-04 COMPLETED (the lifespan try-guard in `main.py` calls `mount_static(app, cfg)` — task-04's lifespan must already exist; otherwise this task only delivers the module + a manual smoke).
- task-09 (or task-10) NOT strictly required — `frontend/dist/` may not exist yet in dev; `mount_static` MUST tolerate a missing `dist` (log a warning, skip the mount) so the lifespan try-guard in task-04 works.

## Owner / recommended agent profile

- Implementer: `native-deployment-operator`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `backend/static.py` — `mount_static(app: FastAPI, cfg: Config) -> None` + an internal `StaticFallback` Starlette route/handler.

Do NOT touch `backend/main.py` (task-04 owns the lifespan try-guard around `mount_static`).

## Concrete implementation steps

1. Resolve `static_dir`:
   - `cfg.server.static_dir` if set (relative paths resolved against the backend working directory; absolute paths used as-is).
   - Else: default to `<repo root>/frontend/dist` (i.e., `Path(__file__).resolve().parent.parent / "frontend" / "dist"`).
2. If `static_dir` does not exist: `logging.warning("static_dir not found: %s; SPA serving disabled", static_dir)`; return WITHOUT mounting. (Non-fatal — useful in dev before task-09 finishes.)
3. Define a custom Starlette `Route` (or `Mount`) at root (`/`) — implement via `mount_static` doing:
   ```python
   from starlette.staticfiles import StaticFiles
   from starlette.responses import FileResponse, JSONResponse
   from starlette.routing import Route

   async def _spa_fallback(request):
       # Path traversal guard
       request_path = request.url.path
       if request_path.startswith("/api/"):
           # never fall through to static for API paths
           return JSONResponse({"error":{"code":"not_found","message":"The requested resource was not found."}}, status_code=404)
       full = (STATIC_DIR / request_path.lstrip("/")).resolve()
       try:
           full.relative_to(STATIC_DIR.resolve())
       except ValueError:
           return JSONResponse({"error":{"code":"not_found","message":"The requested resource was not found."}}, status_code=404)
       # exact file
       if full.is_file():
           return _file_response(full, request_path)
       # .html fallback
       alt = full.with_suffix(".html")
       if alt.is_file():
           return _file_response(alt, request_path)
       # SPA fallback
       index = STATIC_DIR / "index.html"
       if index.is_file():
           # return 200 index.html (NOT 404) — React Router owns client routes (plan §6 #4)
           return _file_response(index, "index.html", spa=True)
       return JSONResponse({"error":{"code":"not_found","message":"The requested resource was not found."}}, status_code=404)

   def _file_response(path: Path, request_path: str, *, spa: bool = False):
       headers = _cache_headers(path, request_path, spa=spa)
       return FileResponse(path, headers=headers, status_code=200)

   def _cache_headers(path: Path, request_path: str, *, spa: bool) -> dict:
       if spa or path.name == "index.html":
           return {"Cache-Control": "no-store"}
       if request_path.startswith("/assets/"):
           return {"Cache-Control": "public, max-age=31536000, immutable"}
       return {"Cache-Control": "no-store"}
   ```
4. Method guard:
   ```python
   async def _guarded(request):
       if request.method not in ("GET", "HEAD"):
           return JSONResponse({"error":{"code":"method_not_allowed","message":"This request method is not allowed."}}, status_code=405)
       return await _spa_fallback(request)
   ```
5. `mount_static(app: FastAPI, cfg: Config) -> None`:
   ```python
   global STATIC_DIR
   STATIC_DIR = _resolve_static_dir(cfg)
   if not STATIC_DIR.exists():
       _logger.warning("frontend/dist not found at %s; not mounting static serving", STATIC_DIR)
       return
   # Mount at root — but AFTER api/v1 router (caller ordering).
   app.router.routes.insert(0, Route("/{path:path}", _guarded, methods=["GET","HEAD"]))
   # The Route is inserted at the FRONT? NO — insert at the END so api/v1 routes (added earlier via include_router) match first.
   # Correct: append, not insert(0).
   ```
   Note carefully: ordering. The `/api/v1/*` routes registered by task-04's `app.include_router(api)` MUST match BEFORE the catch-all `/{path:path}` static route. In Starlette/FastAPI, route matching is order-of-registration. So `mount_static` MUST be called AFTER `app.include_router(api)` in task-04's lifespan — task-04's lifespan try-guard already does this; ensure `mount_static` appends the catch-all at the end (use `app.router.routes.append(...)` to be explicit, or rely on `app.add_route(...)` which appends).
6. Verify the `/api/*` non-fall-through with `curl /api/v1/health` AFTER the static mount returns 200 `{"status":"ok"}` — never the SPA fallback.

## Interfaces/contracts and integration points

- `mount_static(app, cfg)` called by task-04's lifespan after `app.include_router(api)` and after `api` routes are registered.
- `STATIC_DIR` is resolved from `cfg.server.static_dir` (plan §8); falls back to `<repo root>/frontend/dist`.
- The catch-all `/{path:path}` route MUST be the LAST route in `app.router.routes` so all `/api/v1/*` routes match before it.
- Cache headers MUST be exact: `index.html` always `no-store`; any `assets/*` file always `public, max-age=31536000, immutable`; everything else `no-store`. API JSON responses are governed by their own response configuration (plan §3 top: `Cache-Control: no-store`); the static handler does not touch API responses.

## Acceptance criteria

- `GET /` (SPA root) → 200 `text/html`, `Cache-Control: no-store`.
- `GET /assets/<hashed>.js` → 200, `Cache-Control: public, max-age=31536000, immutable`.
- `GET /unknown-route` → 200 HTML (SPA fallback) — NOT 404.
- `POST /unknown-route` → 405 JSON error envelope.
- `GET /api/v1/health` → 200 JSON `{"status":"ok"}` — NEVER the SPA fallback.
- Path traversal: `GET /../../etc/passwd` (URL-encoded) → 404 JSON error (NOT served; traversal guard rejects).
- `mount_static` returns silently (no exception) when `frontend/dist` does not exist — `main.py` boots fine in this case.

## Verification commands/checks

From `backend/` with task-04 + task-09/10 landed (so `frontend/dist/index.html` exists):
- `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --port 8090 &` then:
  - `curl -i -s http://127.0.0.1:8090/ | head -5` → 200 + `text/html` + `Cache-Control: no-store`.
  - `ASSET=$(ls ../frontend/dist/assets/*.js 2>/dev/null | head -1 | xargs basename); curl -i -s "http://127.0.0.1:8090/assets/$ASSET" | grep -i 'cache-control'` → `public, max-age=31536000, immutable`.
  - `curl -s -i http://127.0.0.1:8090/some-unknown-client-route | head -1` → `HTTP/1.1 200 OK` (SPA fallback).
  - `curl -s -i -X POST http://127.0.0.1:8090/ | head -1` → `HTTP/1.1 405 ...`.
  - `curl -s http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}` (API still hits its route, not static).
- Path traversal: `curl -s -i 'http://127.0.0.1:8090/%2e%2e/%2e%2e/etc/passwd' | head -1` → `HTTP/1.1 404 ...`.

If `frontend/dist` not built yet (task-09/10 in progress): temporarily `mkdir -p ../frontend/dist && echo "<html>SPA</html>" > ../frontend/dist/index.html` to smoke-test the mount, then clean up. Otherwise, just verify `mount_static` returns silently when `dist/` is absent: `uv run python -c "from fastapi import FastAPI; from config import Config, load_config; from static import mount_static; app=FastAPI(); mount_static(app, Config(server={'bind':'127.0.0.1','port':8090,'static_dir':'/nonexistent'}, cscli={'timeout':'30s'}, logging={})); print('OK no-raise')"`. (May need to ignore validation; use raw `load_config` if `Config(server={...})` strict-pydantic refuses — adjust.)

## Explicit out-of-scope

- Building the frontend (tasks 09/10).
- Editing `backend/main.py` (task-04 — lifespan order matters; if task-04 has bugs with route ordering, fix there, not here).
- Tests/pytest (D12).
- Editing the source plan.

## Coordinator status
- Status: completed
- Completed by: native-deployment-operator (via coordinator)
- Completed at: 2026-08-16T13:25:00Z
- Verification: `from static import mount_static` → import OK; functional TestClient smoke → `task-08 functional CHECKS OK` (API route hits handler NOT static 200 {"status":"ok"}; SPA root 200 + `Cache-Control: no-store`; `/assets/app.js` 200 + `public, max-age=31536000, immutable`; unknown client route → 200 SPA fallback NOT 404; `POST /` → 405 method_not_allowed envelope; `/%2e%2e/%2e%2e/etc/passwd` → 404 not_found envelope); missing-dist smoke → `static_dir not found: ... SPA serving disabled` + `no-raise OK`; integration with task-04 confirmed: `uvicorn main:app` boots, task-04 lifespan try-guard calls `mount_static(app, cfg)`, real `frontend/dist/index.html` served with `cache-control: no-store` while `/api/v1/health` returns 200 {"status":"ok"}
- Commit or artifact reference: working tree
