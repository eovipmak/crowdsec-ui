# Plan: Greenfield rebuild — FastAPI + lightweight React SPA (read-only, slim scope)

Date: 2026-08-15
Status: Approved (revised), awaiting handoff
Supersedes: prior draft of this same file (which proposed auth/session, mutations, command-matrix doc, capabilities-as-doc, pytest suite, Go cleanup). All dropped per user direction — see §11.

## 1. Goal

Replace the prior Go backend (already deleted by the user) and any Next.js frontend with a lightweight two-piece system:

1. **FastAPI backend (Python)** at `/root/crowdsec-ui/backend/` — scaffolding already exists; this plan upgrades it in-place. The backend invokes `cscli` via `asyncio.create_subprocess_exec` (mandatory exec, never shell) with `-o json` for structured reads. No application DB, no direct CrowdSec DB access, no shell.
2. **New frontend SPA** at `/root/crowdsec-ui/frontend/` — Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (in-repo) + React Router 7 + TanStack Query v5. **Read-only**: no login, no mutations, no client state outside TanStack Query cache. Served as static files by the same FastAPI service (single uvicorn process, one port).

## 2. Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Backend framework | FastAPI + Pydantic v2 (transitive via `fastapi[standard]`), uvicorn | Already scaffolded; keep flat `backend/{main.py, routers/*}` (— no `backend/app/` package) |
| D2 | Data access | cscli subprocess via `asyncio.create_subprocess_exec`, positional argv, `-o json` for structured ops; argv built server-side from typed params; executable path from config only | No shell, no DB |
| D3 | Frontend stack | Vite 6 + React 19 + TS strict + Tailwind v4 CSS-first + shadcn/ui (in-repo) + React Router 7 + TanStack Query v5; native `fetch` | Replaces Next.js |
| D4 | Feature scope | 6 read-only pages: Overview, Alerts, Decisions, Machines, Bouncers, Allowlists | Login + mutations dropped |
| D5 | Auth/session | DROPPED — endpoints are publicly reachable on the bound (loopback) interface | "Login tính sau" per user |
| D6 | Mutations | DROPPED — no POST/DELETE-mutation routes, no forbidden-flag validator, no `MutationResult` | Dashboard is read-only |
| D7 | Config schema | YAML schema reduced to `server`, `cscli`, `logging` (drop `auth`, `session`); legacy configs with dropped blocks tolerated via Pydantic `extra="ignore"` | No auth |
| D8 | Deployment | Single uvicorn service: FastAPI serves `/api/v1` AND `frontend/dist/` static; one systemd unit | Same as prior plan |
| D9 | Capabilities endpoint | KEPT, simplified to `supported`/`unsupported` per op, computed once at startup, cached in `app.state.capabilities` | Old D9 retained |
| D10 | Envelope | Minimal `{operation, result}` / `{operation, error}` / `{error}` — drop `source.command`, `request`, `page` blocks; drop the 15-error-code table | User choice |
| D11 | Command-matrix doc | NOT produced — command vectors are decided inline in the router modules under `backend/routers/*` | User direction |
| D12 | Testing | NO pytest, NO unit tests, NO `backend/tests/`, NO `fake-cscli` fixture — manual verification + `npm run build` | User direction |
| D13 | Go code cleanup | N/A — already done by user | Already complete |
| D14 | Check endpoints | `decisions/check/{ip}` and `allowlists/check/{ip}` keep PATH PARAM (already coded in the prototype) | User choice |

## 3. Wire contract (consumed by frontend)

All JSON responses: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`.

### 3.1 Envelope (minimal)

Success (HTTP 200):
```
{ "operation": "alerts.list", "result": <data> }
```

Operation-level failure (HTTP 200) — cscli was invoked and failed:
```
{ "operation": "decisions.list", "error": { "code": "crowdsec_failure", "message": "..." } }
```

Request-level failure (HTTP 4xx/5xx):
```
{ "error": { "code": "invalid_parameters", "message": "..." } }
```

`result` payload conventions:
- Collections → JSON array of transformed objects (no pagination block).
- Inspect → transformed object.
- `allowlists.check` → `{ "matched": <bool> }`.
- `status.lapi` → `{ "healthy": <bool> }`.
- `status.capi` → `{ "enabled": <bool> }`.
- `capabilities` → `{ "<op>": { "supported": <bool> } }`.
- `health` → `{"status": "ok"}` (returned OUTSIDE the envelope).

### 3.2 Error codes (minimal set)

Request-level (4xx/5xx):

| code | status | message |
|---|---|---|
| `invalid_parameters` | 400 | The request parameters are invalid. |
| `not_found` | 404 | The requested resource was not found. |
| `method_not_allowed` | 405 | This request method is not allowed. |
| `internal` | 500 | An unexpected server error occurred. |

Operation-level (HTTP 200, always safe message):

| code | condition |
|---|---|
| `crowdsec_failure` | cscli exited non-zero |
| `timeout` (retryable) | cscli deadline exceeded |
| `unavailable` (retryable) | cscli executable not found |
| `permission_denied` | EACCES on cscli exec |
| `malformed_output` | cscli JSON parse failed |
| `unsupported` | capability probe disabled this op |

ALL messages are safe strings; cscli stderr is captured for LOGS ONLY, NEVER returned.

### 3.3 Routes (all under `/api/v1`, no auth, no CSRF)

| Method | Path | Params | Notes |
|---|---|---|---|
| GET | `/health` | — | liveness, never invokes cscli; returns `{"status":"ok"}` |
| GET | `/capabilities` | — | cached map from startup probes |
| GET | `/alerts` | `limit` (1..100, default 50), `scenario`, `ip` | array of transformed alerts |
| GET | `/alerts/{id}` | id: int (path param) | transformed flat alert object |
| GET | `/decisions` | `limit`, `type`, `ip` (all optional) | array (first-decision-per-alert flattened) |
| GET | `/decisions/check/{ip}` | ip: str (path param, URL-encoded) | array of per-decision rows |
| GET | `/machines` | — | array |
| GET | `/machines/{machine_id}` | machine_id: str (path param) | object |
| GET | `/bouncers` | — | array |
| GET | `/bouncers/{name}` | name: str (path param) | object |
| GET | `/allowlists` | — | array of `{name, description, created_at, updated_at, size}` |
| GET | `/allowlists/{name}` | name: str (path param) | object incl. items |
| GET | `/allowlists/check/{ip}` | ip: str (path param) | `{matched: bool}` |
| GET | `/status/lapi` | — | `{healthy: bool}` |
| GET | `/status/capi` | — | `{enabled: bool}` |

Dropped from prior plan: `/session*`, `/metrics/{component}`, all mutation endpoints.

### 3.4 Query rules (minimal)

- `limit`: integer, `1 ≤ limit ≤ 100`; default `50`.
- Unknown query key → HTTP 400 `invalid_parameters`.
- Duplicate key → HTTP 400.
- Filters (`scenario`, `ip`, `type`): server-side (pass through to cscli argv where supported; otherwise post-filter as the current prototype does).
- No Pydantic strict request bodies (all routes are GET; `Query()` typed parameters suffice).

## 4. cscli execution model

- Invoke via `asyncio.create_subprocess_exec(config.cscli.executable_path, *argv)`, NEVER shell.
- Per-command timeout from config (default 30s; startup probes use 5s).
- Executable path resolution at startup: config value if provided, else first existing of `/usr/bin/cscli`, `/usr/local/bin/cscli`, `/opt/crowdsec/bin/cscli`; else `None` (probes mark all ops `unsupported`).
- Error taxonomy → §3.2 operation-level codes.
- stderr captured for LOGS, NEVER returned to client (the current prototype's `HTTPException(500, detail=stderr.decode())` is a bug to fix in task-02).
- Empty stdout with exit 0 → empty collection `[]` (not `malformed_output`).
- argv never exposed in responses (no `source.command` block in the compact envelope).

### 4.1 Startup probes (run once; cached into `app.state.capabilities`)

1. `alerts list -o json -l 1` (5s timeout). Success ⇒ structured-output reads: `alerts.list`, `alerts.inspect`, `decisions.list`, `decisions.check`, `machines.list`, `machines.inspect`, `bouncers.list`, `bouncers.inspect`, `allowlists.list`, `allowlists.inspect`, `allowlists.check`.
2. `lapi status` (5s, no `-o json`). Success ⇒ `status.lapi` supported.
3. `capi status` (5s, no `-o json`). Success ⇒ `status.capi` supported.

`/capabilities` returns the cached map; never invokes cscli at request time. Failed probes degrade the affected op to `unsupported`; a request hitting an unsupported op returns `{operation, error: {code: "unsupported"}}` WITHOUT invoking cscli.

### 4.2 Live-verification caveat

Startup probes ARE the live-verification mechanism. No separate smoke-pass doc artifact; the prior plan's "Phase 2 smoke pass" is dropped (D11/D13 + user direction). Ops failing at probe time degrade to `unsupported` and per-request handlers honor that without shelling out.

## 5. Output transforms (cscli JSON → API result)

Follows the existing prototype field-mapping (already coded), with two changes plus two new additions:

1. **alerts** (list + inspect): keep the current `extract_meta` flatten (`source.scope/value/cn/as_number/as_name` → `scope, value, country, as_number, as_name`; `events_count → events`; `machine_id → machine`; `reason = scenario`; `decisions[] = {type, duration}`).
2. **decisions**: keep current selection (first decision per alert in `/decisions`; all decisions flattened in `/decisions/check`).
3. **machines / bouncers / allowlists**: keep current field picking.
4. **CHANGED** — `allowlists.check`: currently returns `PlainTextResponse(raw_stdout)`. Switch to `envelope.success("allowlists.check", {"matched": <bool>})` where `matched = "found" in stdout.decode().lower()`.
5. **NEW** — `status.lapi`: `cscli lapi status` (no JSON); `healthy = "successfully interact" in stdout.decode().lower()`.
6. **NEW** — `status.capi`: `cscli capi status` (no JSON); `enabled = stdout.decode().strip() != ""`.

## 6. Static serving

`backend/static.py` mounts `frontend/dist/` (path from config `server.static_dir`, default `<repo root>/frontend/dist`) at root (`/`) AFTER all `/api/v1` routes. Rules:

1. Method ≠ GET/HEAD → HTTP 405 JSON error body.
2. Exact file at cleaned path (`/` → `index.html`; hashed assets under `assets/`).
3. `<path>.html` fallback for prerendered routes (likely unused by Vite SPA; retain).
4. Everything else → SPA fallback `index.html` with HTTP 200 (React Router owns client routes).
5. Path traversal guard (resolve + prefix check).
6. `/api/*` requests NEVER fall through to the static handler.
7. Cache headers: `index.html` → `no-store`; `assets/*` → `public, max-age=31536000, immutable`; API responses → `no-store`.

## 7. Frontend design (`/root/crowdsec-ui/frontend/`)

Stack: Vite 6, React 19, TypeScript (strict), Tailwind CSS v4 (CSS-first config via `@import "tailwindcss"`), shadcn/ui components in-repo (`frontend/src/components/ui/*`), React Router 7, TanStack Query v5, native `fetch` (no axios, no Next.js).

`vite.config.ts` dev proxy: `/api` → `http://127.0.0.1:8090`. Env override `DASHBOARD_API_TARGET` retained.

### 7.1 Pages (read-only)

- `/overview`: status cards (alerts/decisions/machines counts), LAPI/CAPI health badges; 30s polling.
- `/alerts`: data table (id, source IP/value, scenario, country/AS, decision, createdAt); filters (scenario, ip); limit picker 25/50/100; row click → inspect dialog (`/alerts/{id}`).
- `/decisions`: data table (id, scenario, source_ip, country/AS, type, value, scope, duration, origin, simulated, created_at); filters + limit picker; no add/delete controls.
- `/machines`: table (machineId, ip, validated, last heartbeat).
- `/bouncers`: table (name, type, version, ip, last pull); no delete control.
- `/allowlists`: cards per allowlist with entries (ip, comment, expiration, source; console-managed → read-only); a "Check IP" card calling `/allowlists/check/{ip}`.
- Unknown route → SPA not-found view (no server 404).

States: loading skeleton, error panel with retry, empty state, `CapabilityBadge` per section (reads `/capabilities`; disables the section with an explanation when `supported: false`).

### 7.2 API client

`frontend/src/lib/api/`:
- `client.ts` — native `fetch` wrapper; parses the minimal envelope (`result` for success; `error.message` for op-failure 200; throw on 4xx/5xx with `error.message`).
- `types.ts` — envelope types + the 8 error-code constants (string values mirror `backend/errors.py` exactly).
- `errors.ts` — message fallback table for unknown codes.

### 7.3 Dropped from frontend scope

- Login page + auth context + auth guard.
- CSRF token context + `X-CSRF-Token` header on mutations.
- TanStack `useMutation` hooks (no mutations).
- ConfirmDialog (no mutations).

## 8. Config YAML (reduced schema)

```yaml
server:  { bind: 127.0.0.1, port: 8090, static_dir: ../frontend/dist }
cscli:   { executable_path: /usr/bin/cscli, timeout: 30s }
logging: { level: info, format: text, output: stderr }
```

Validation:
- `server.bind` must NOT be `0.0.0.0` (forces loopback or NIC IP).
- `server.port` must NOT be `8080` (reserved for LAPI).
- `server.static_dir` optional; default `<repo root>/frontend/dist`.
- `cscli.executable_path` optional; resolved at startup from the fallback list when omitted.
- `cscli.timeout` parsed from `^\d+s$` to int seconds; bounds 1s..120s.
- `logging.level` ∈ {debug, info, warn, error}; `logging.format` ∈ {text, json}; `logging.output` ∈ {stderr, stdout, <path>}.

Legacy `auth` / `session` blocks in existing configs are tolerated (Pydantic `extra="ignore"`) but ignored.

## 9. Implementation phases (mapped to 11 kanban tasks)

Tasks live at `docs/kanban/2026-08-15_fastapi-rebuild/task-01.md` … `task-11.md`.

- **Phase 1 — Backend foundation** → task-01
- **Phase 2 — cscli runner upgrade** → task-02
- **Phase 3 — Read modules (capabilities, status, read ops)** → task-03 (capabilities), task-05 (status), task-06 (alerts+bouncers), task-07 (decisions+machines+allowlists) — parallel Wave 2
- **Phase 4 — main.py rewrite + integration** → task-04
- **Phase 5 — Static serving** → task-08
- **Phase 6 — Frontend** → task-09 (scaffold) + task-10 (pages)
- **Phase 7 — Deploy + docs** → task-11

Dependency waves:
- Wave 0: task-01.
- Wave 1 [parallel]: task-02, task-09 (frontend scaffold depends only on the envelope contract established in task-01).
- Wave 2 [parallel]: task-03, task-05, task-06, task-07 (all depend on task-02; disjoint files).
- Wave 3 [parallel]: task-04 (after task-02, task-03, task-05, task-06, task-07); task-10 (after task-09).
- Wave 4: task-08 (after task-04).
- Wave 5: task-11 (after task-04, task-08, task-10).

## 10. Verification (manual — no pytest)

1. **Backend** (from `backend/`):
   - `uv sync` green.
   - `DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090` boots without error (config loads, probes run; on a host WITHOUT cscli, probes fail silently and `/capabilities` reports all ops `unsupported`).
   - `curl http://127.0.0.1:8090/api/v1/health` → `{"status":"ok"}`.
   - `curl http://127.0.0.1:8090/api/v1/capabilities` → `{"operation":"capabilities.list","result":{...}}`.
   - `curl http://127.0.0.1:8090/api/v1/alerts` → envelope success with `result: [<transforms>]`, or op-failure envelope when cscli missing.
   - `curl http://127.0.0.1:8090/api/v1/status/lapi` → `{"operation":"status.lapi","result":{"healthy":<bool>}}`.
   - `curl -i 'http://127.0.0.1:8090/api/v1/alerts?limit=999'` → HTTP 400 `{"error":{"code":"invalid_parameters","message":"..."}}`.
   - No response body contains cscli stderr (spot-check).
2. **Frontend** (from `frontend/`):
   - `npm install` green.
   - `npm run typecheck` green.
   - `npm run build` green; `dist/index.html` + `dist/assets/*.js` exist.
   - `vite dev` against running `uvicorn` → walk 6 pages; each shows live data or empty state when cscli returns `[]`.
3. **Static E2E** with `uvicorn main:app` running:
   - `curl -i /` → 200 `text/html` + `Cache-Control: no-store`.
   - `curl -i /assets/<hashed>.js` → 200 `Cache-Control: public, max-age=31536000, immutable`.
   - `curl -i /api/v1/health` → 200 JSON.
   - `curl -i /unknown-route` → 200 HTML (SPA fallback) — NOT 404.
4. **Build script**: `bash backend/build.sh` green end-to-end; `frontend/dist/index.html` exists after.

## 11. Out of scope (DROPPED vs original draft)

- `docs/command-matrix.md` — never produced.
- All mutation endpoints and the 7 mutation operations.
- Auth, session, CSRF, login flow; bcrypt hashing; auth-config schema.
- `/metrics/{component}` endpoint.
- pytest suite, unit tests, `backend/tests/`, `tests/fixtures/fake-cscli`.
- Go code cleanup (`backend/internal/`, `cmd/`, `go.mod`, `bin/`) — already done by user.
- Server-side confirmation-token endpoint (moot, no mutations).
- Forbidden-flag enforcement module (`backend/app/forbidden.py`) — moot, no mutations.
- The Phase 2 command-matrix live-smoke-pass doc artifact.

## 12. File map

| Status | Paths |
|---|---|
| New | `backend/config.py`, `backend/envelope.py`, `backend/errors.py`, `backend/capabilities.py`, `backend/static.py`, `backend/routers/status.py`, `backend/routers/capabilities.py` (or router inline in `capabilities.py`), new `frontend/src/**` |
| Modified | `backend/pyproject.toml`, `backend/main.py`, `backend/routers/cscli.py`, `backend/routers/alerts/{list,inspect}.py`, `backend/routers/decisions/{list,check}.py`, `backend/routers/machines/{list,inspect}.py`, `backend/routers/bouncers/{list,inspect}.py`, `backend/routers/allowlists/{list,inspect,check}.py` |
| Created again (deploy + docs) | `backend/build.sh`, `deploy/crowdsec-dashboard.service`, `deploy/config.example.yaml`, `deploy/install/README.md`, root `config.yaml`, `docs/architecture.md`, `docs/operations-reference.md` |
| Deleted (leftover kanban) | `docs/kanban/2026-08-15_fastapi-rebuild/task-12.md`, `task-13.md` (old; safe to delete after the kanban rewrite) |

## 13. Open considerations (RESOLVED)

1. ✅ Plan file treatment: rewrite `docs/plans/2026-08-15_fastapi-rebuild.md` in-place with this content.
2. ✅ Kanban treatment: rewrite `docs/kanban/2026-08-15_fastapi-rebuild/` with `README.md` + `task-01.md` … `task-11.md`; delete old `task-12.md` and `task-13.md`.
3. ✅ Check endpoints: keep path param `/decisions/check/{ip}` and `/allowlists/check/{ip}` (already coded).
