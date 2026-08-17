# Plan: Feature Research — Ranked Candidates & Hub Inventory Proposal

Date: 2026-08-17
Status: Selected — #1 Hub Inventory & Tainted Detection (user confirmed 2026-08-17) — ready for implementation
Type: Exploratory research (default invocation, no explicit feature requested) → refined to single-feature detail for #1
Supersedes: N/A (extends `2026-08-15_fastapi-rebuild.md` + `2026-08-16_metrics-endpoint.md` — both now implemented)

## 1. Goal and Non-Goals

### Goal (research phase)
Enumerate the highest-value next features for this single-admin, single-port (8090), read-only CrowdSec Dashboard, rank 5 candidates by user value × implementation cost under lean/native constraints, and detail the top proposal to implementation-ready depth so the user can pick one and proceed without re-planning.

### Goal (recommended feature — Candidate #1)
Add a **read-only Hub Inventory page** that surfaces `cscli hub list -o json` + `cscli collections/parsers/scenarios/postoverflows list` through the existing `CscliRunner` / envelope / startup-probe pattern, with tainted/missing/upgrade-available signals. Single port, no DB, no shell, no new deploy topology.

### Non-Goals (all candidates — and this plan)
- **Mutations** (`decisions add/delete`, `bouncers/machines/allowlists add/delete`, `hub update/upgrade` writes) — read-only invariant holds for #1/#2/#3/#4; #5 (decisions delete) is the only candidate that would break it and is ranked last / deferred.
- **Auth/session/RBAC/LDAP/OIDC** — still deferred per `docs/architecture.md` § Out of scope; loopback-bound posture unchanged.
- **Prometheus text exposition** (`GET /metrics` scrape) or Grafana/Prometheus/alerting platform — taste: lean internal tools; CrowdSec's own `/metrics` is scraped directly.
- **Persistence/history/aggregation** — hub/metrics/simulation are live from `cscli` on every request (plus probe cache); no DB, no retention.
- **CI/CD, pytest/unit tests, test scaffolding, monitoring dashboards** — explicitly excluded per workflow rules unless user requests them.
- **Docker/K8s, separate databases, new systemd units** — native binary + PM2/uvicorn only.
- **Parser/scenario/WAF rule authoring** — out of scope per `crowdsec` skill.

## 2. Current-State Findings

### 2.1 What exists today (inventory)
- **Backend:** FastAPI + Pydantic v2, `backend/main.py:app` (uvicorn `:8090`), `CscliRunner` via `asyncio.create_subprocess_exec` (positional argv, no shell), 15 operation labels in `backend/envelope.py`, 4 startup probes in `backend/capabilities.py` cached to `app.state.capabilities`, 14 probed ops + `capabilities.list` meta-op. All `GET /api/v1/*` enveloped (`success`/`operation_error` HTTP 200, `request_error` 4xx/5xx, raw `health`), 10 error codes, WARN-logged truncated stderr never returned, `Cache-Control: no-store` on API + SPA fallback.
- **Routers:** `alerts/{list,inspect}`, `decisions/{list,check}`, `machines/{list,inspect}`, `bouncers/{list,inspect}`, `allowlists/{list,inspect,check}`, `status` (`lapi`/`capi`), `capabilities`, `metrics/show` (14-component allowlist) — all read-only `GET`.
- **Frontend:** Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn/ui + React Router 7 + TanStack Query v5 + native `fetch`. 7 routes under `Layout` (`/overview`, `/alerts`, `/decisions`, `/machines`, `/bouncers`, `/allowlists`, `/metrics`), `DataTable`/`FiltersBar`/`ErrorPanel`/`EmptyState`/`CapabilityBadge`/`LoadingSkeleton`, 30s `refetchInterval` via `QueryClient`, proxy `/api → 127.0.0.1:8090`.
- **Config/deploy:** Slim YAML `server/cscli/logging` only (`extra="ignore"` for legacy `auth/session`), `cscli.timeout` `^\d+s$` 1..120s, `bind !=0.0.0.0`, `port !=8080`, `DASHBOARD_CONFIG` precedence. Single-port static SPA fallback last (`backend/static.py`), PM2 `ecosystem.config.cjs`, no Docker required (footer).
- **Docs/plans:** `docs/architecture.md` + `docs/operations-reference.md` canonical wire contract; `docs/plans/2026-08-15_fastapi-rebuild.md` (11 kanban tasks, read-only rebuild) + `docs/plans/2026-08-16_metrics-endpoint.md` (revived `metrics.show`, now shipped) are implemented; no open TODO/FIXME in app code.

### 2.2 Relevant files (read)
`AGENTS.md`, `docs/architecture.md`, `docs/operations-reference.md`, `docs/plans/2026-08-16_metrics-endpoint.md`, `backend/main.py`, `backend/config.py`, `backend/envelope.py`, `backend/errors.py`, `backend/capabilities.py`, `backend/static.py`, `backend/routers/cscli.py`, `backend/routers/metrics/show.py`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/lib/api/{client,types,errors}.ts`, `frontend/package.json`, `config.yaml`, `deploy/ecosystem.config.cjs`.

### 2.3 Research summary

#### Existing feature inventory
| Domain | UI | API | Notes |
|---|---|---|---|
| Alerts list + inspect | ✅ table + dialog | `alerts.list`/`inspect` | `limit/scenario/ip` only; no `since/until`/pagination |
| Decisions list + check | ✅ table | `decisions.list`/`check` | read-only; no add/delete/unban |
| Machines list (+ inspect backend, no UI dialog) | partial | `machines.list`/`inspect` | list only in UI |
| Bouncers list (+ inspect backend, no UI dialog) | partial | `bouncers.list`/`inspect` | list only in UI |
| Allowlists list + check (+ inspect backend, no entries table) | partial | `allowlists.list`/`inspect`/`check` | size badge only; no entry drill-down |
| LAPI/CAPI status | ✅ Overview dots | `status.lapi`/`capi` | boolean only |
| Metrics show (all + 14 filtered) | ✅ tables + `<pre>` fallback | `metrics.show` | live, heterogeneous `Record<string,unknown>` |
| Hub / collections / parsers / scenarios | ❌ missing | ❌ | biggest gap |
| Simulation status | ❌ missing | ❌ | common "alerts but no bans" trap |
| Config/version | ❌ missing | ❌ | `cscli version`, `config show` not wrapped |

#### Candidate features considered (ranked 5 — value × cost)

| Rank | Candidate | Value | Cost | Rationale |
|---|---|---|---|---|
| **#1 Recommended** | **Hub Inventory & Tainted Detection** — `hub.list` + `hubtypes.list` read-only | High | Low-Medium | Answers #1 triage question after `lapi status`: "what broke after `hub upgrade`?" (`tainted`/`missing`/`update-available`). Pure read-only, reuses `metrics.show` pattern exactly, zero auth/mutation risk. Most-requested gap per crowdsec skill `references/operate/upgrades.md`. |
| #2 | **Simulation Status Visibility** — `simulation.status` banner | High (debug) | Low | `cscli simulation status` explains "alerts but empty decisions" (global/perscenario simulation). One argv, text parse, saves SSH trip. Lowest effort, high confusion-reduction. |
| #3 | **Inspect Completion** — frontend drill-down for existing backends (`machines.inspect`/`bouncers.inspect`/`allowlists.inspect` entries) | Medium-High | Low | Backends already shipped but UI only lists; add dialogs/tables + inline IP check. Completes half-built feature, no new ops/probes. |
| #4 | **Time-Range & Search** — `since`/`until` + substring `scenario` + pagination for alerts/decisions | Medium-High | Low-Medium | LAPI may hold 10k alerts; `limit 50/100` only today. Pass `cscli alerts list --since/--until` through + server-side `contains` filter + date picker. Small query-plan change. |
| #5 | **Supervised Decisions Delete (first mutation)** — `decisions.delete` (`-i ip`/`-r range`/`--id`, never `--all`) | High (self-unblock) | Medium-High | Only candidate that breaks read-only invariant. Needs confirmation dialog, audit, and ideally auth hardening first. High value for lockout recovery but bigger risk/scope — defer until read-only gaps closed. |

#### Selection rationale (#1)
- **Lean fit:** read-only, no DB, no auth, single-port, no new deploy artifact — taste requires minimal scope and native deployment; #1 respects all.
- **Proven pattern:** `metrics.show` shipped 2026-08-16 with same envelope/probe/router/hook/page/docs shape; #1 is a direct repeat, so estimates are grounded and review is fast.
- **User-visible gap:** Hub state is the only CrowdSec domain with zero coverage; metrics already shows `parsers`/`scenarios` counters but not *which* collections are installed/tainted. Operators currently must SSH for `cscli hub list`.
- **Cost vs alternatives:** #2 and #3 are smaller but narrower; #4 is useful but less urgent than "am I up to date / is my install tainted"; #5 is higher value long-term but violates the read-only promise the project explicitly kept — deferring it keeps this release safe and shippable.

#### Rejected / deferred candidates (brief)
- **AppSec/WAF rule editor, parser/scenario authoring** — crowdsec skill marks writing rules out of scope; deploy/status only, already partially via `metrics.show appsec-*`.
- **Notifications CRUD** (Slack/email/webhook) — no `cscli notifications` wrapper, lower frequency, needs persistence.
- **Prometheus/Grafana/metrics history & charts** — taste excludes observability platform; live tables suffice.
- **Console/CAPI enroll detail, `support dump`, `explain --log`** — niche debug tools, lower daily value.
- **LDAP/OIDC/RBAC, multi-server, Postgres remote/mTLS** — enterprise auth/multi-host is taste-rejected for single-admin internal tool.
- **Bouncers/machines allowlist CRUD, bulk import/export, CSV export** — mutations or non-trivial persistence; defer after read-only inventory is solid.

## 3. Proposed Architecture and Data/Control Flow

### 3.1 Top proposal (#1) — Hub Inventory

```
Browser ── GET /api/v1/hub  ──► FastAPI /api/v1
                                 ├─ check app.state.capabilities["hub.list"].supported
                                 │   └─ false → {operation:"hub.list", error:{code:"unsupported"}} (HTTP 200, no cscli)
                                 ├─ validate query: no unknown/duplicate keys → else 400 invalid_parameters (no spawn)
                                 ├─ CscliRunner.run(["hub","list","-o","json"])  (timeout = cfg.cscli_timeout_seconds)
                                 ├─ RunResult → classify_failure → operation_error("hub.list", code) (HTTP 200, stderr WARN-truncated)
                                 ├─ parse stdout JSON; malformed/empty → malformed_output or [] handling
                                 └─ success("hub.list", <normalized result>) (HTTP 200, Cache-Control: no-store)

Browser ── GET /api/v1/hub/types ──► same gate but ["hubtypes","list"] or ["collections","list"] fallback
                                     (decided at implementation — see §5.3)

Startup:  lifespan() → load_config → resolve_cscli_path → CscliRunner → probe_capabilities()
          probe_capabilities adds Probe #5: ["hub","list","-o","json"] (5s).
          Success → caps["hub.list"]={supported:true}; failure → {supported:false}.
          Optional Probe #6 for hubtypes if split — or single probe covers both (decision to validate).
```

**Why this shape:**
- Single operation label `hub.list` for both `/hub` and `/hub/types` (mirrors `metrics.show` for `/metrics` + `/metrics/{component}`) keeps capabilities at 15, not 16.
- Alternative split `hub.list` + `hubtypes.list` is valid but adds probe/label cost for little gain — validate on host whether `cscli hub list -o json` already contains per-type breakdown (collections/parsers/scenarios/postoverflows) or whether separate `cscli hubtypes list` is needed; prefer single endpoint if payload is self-contained.

### 3.2 Architecture notes for other candidates (not detailed unless selected)
- **#2 simulation:** Probe `["simulation","status"]` (no `-o json`, text parse `global: enabled/disabled`); `GET /api/v1/simulation` → `{"global":bool,"scenarios":string[]}`. Banner in `Overview` + badge in `Decisions`.
- **#3 inspect completion:** No backend change; frontend adds `AlertInspectDialog`-style dialogs for machines/bouncers + entries table for allowlists (reuse `DataTable`/`CapabilityBadge`).
- **#4 time-range:** Extend `GET /alerts?since=&until=&scenario_contains=` → argv `["alerts","list","-o","json","-l",limit,"--since",since]` etc.; server-side substring filter for `scenario_contains`; date picker in `FiltersBar`.
- **#5 decisions delete:** First `POST`/`DELETE` mutation: `DELETE /api/v1/decisions/{id}` + `DELETE /api/v1/decisions?ip=&range=` with allowlisted `cscli decisions delete -i/-r/--id` (never `--all`), `ConfirmDialog`, audit log, and ideally auth gate — biggest contract change, needs reviewer sign-off.

## 4. Exact Files / Directories to Create and Modify

### 4.1 Top proposal (#1) — Hub Inventory

**Backend — new**
- `backend/routers/hub/__init__.py` — package marker.
- `backend/routers/hub/list.py` — `router = APIRouter(prefix="/hub", tags=["Hub"])` with `GET ""` (and optionally `GET "/types"`); allowlist validation, `CscliRunner.run()`, `classify_failure`, JSON parse + `success/operation_error` envelopes, WARN log truncated stderr.

**Backend — modified**
- `backend/envelope.py` — add `HUB_LIST = "hub.list"` (15th op label, single source of truth; now 15 ops + health).
- `backend/capabilities.py` — add `HUB_LIST` to caps dict; add Probe #5 (`["hub","list","-o","json"]`, 5s) covering `hub.list`; include in startup `probe_capabilities()` return shape `dict[str,{supported:bool}]` now 15 entries.
- `backend/main.py` — `from routers.hub.list import router as hub_router` + `api.include_router(hub_router)` before static mount; no other change.
- `docs/architecture.md` — add `hub.list` to operation list, extend probe table (5 probes), update route table, remove from any "out of scope" mention.
- `docs/operations-reference.md` — add endpoint row(s) per §5.1, extend envelope examples.

**Frontend — new**
- `frontend/src/hooks/useHub.ts` — `useHub()` (and `useHubTypes()` if split) via `apiGet("/hub")`, `HubResult` types (see §5.5 — defensive `Record<string,unknown>` + typed helpers for `tainted/missing/update_available`).
- `frontend/src/pages/Hub.tsx` — read-only page: summary cards (installed collections count, tainted/missing badges), per-type tables (collections/parsers/scenarios/postoverflows) with columns `name | version (installed→latest) | status (ok/tainted/missing/update-available) | description`, `CapabilityBadge(hub.list)`, `LoadingSkeleton`/`ErrorPanel`/`EmptyState`.

**Frontend — modified**
- `frontend/src/lib/api/types.ts` — add `HUB_LIST = "hub.list"` constant (mirror backend).
- `frontend/src/App.tsx` — add `Hub` route (`/hub`).
- `frontend/src/router.tsx` — add `hub` entry.
- `frontend/src/components/Layout.tsx` — add "Hub" nav item (icon `lucide-react:Package` or `Boxes`; keep dark theme, `NAV_ITEMS` now 8).

**Docs/deploy — modified (minimal)**
- `deploy/config.example.yaml` — no new key; optionally comment that hub respects `cscli.timeout`.

**Explicitly not created**
- `backend/tests/`, new DB, Prometheus exporters, Grafana dashboards, `docs/command-matrix.md` (still dropped), auth/session files.

### 4.2 Other candidates (if selected after this plan — sketch)
- **#2:** same backend shape (`simulation` router, `SIMULATION_STATUS` label, probe `simulation status`), `useSimulation` hook, banner in `Overview.tsx`.
- **#3:** frontend only: `frontend/src/pages/Machines.tsx` + `Bouncers.tsx` + `Allowlists.tsx` dialogs/tables, `useMachinesInspect`/`useBouncersInspect` hooks already exist — wire them.
- **#4:** `backend/routers/alerts/list.py` + `decisions/list.py` query-param extension (`since/until/scenario_contains/page`), `frontend/src/components/FiltersBar.tsx` date picker.
- **#5:** `backend/routers/decisions/delete.py` (new mutation), `frontend/src/hooks/useDeleteDecision.ts` (`useMutation`), `ConfirmDialog` — plus `backend/errors.py` consideration for mutation codes (none new).

## 5. Interfaces, Schemas, Routes, Commands, Configuration Contracts

### 5.1 HTTP interface (extends `docs/architecture.md` + `docs/operations-reference.md`)

All responses: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` (API + `index.html` SPA fallback rule unchanged).

| Method | Path | Operation | Params | Success `result` shape | Notes |
|--------|------|-----------|--------|------------------------|-------|
| GET | `/api/v1/hub` | `hub.list` | — (any query key or duplicate → 400 `invalid_parameters` without spawn) | `HubInventory` (see §5.5) — normalized from `cscli hub list -o json` | Full hub snapshot |
| GET | `/api/v1/hub/types` | `hub.list` | same validation | `Record<string, HubItem[]>` keyed by type (`collections/parsers/scenarios/postoverflows`) | Only if payload split needed; else omit and keep single `/hub` |
| GET | `/api/v1/capabilities` | `capabilities.list` | — | Now 15 entries (was 14) | Probe cache, unchanged behavior |

**Validation rules (new):**
- Unknown query key on `/hub` → `400 {error:{code:"invalid_parameters"}}`.
- Duplicate query key → 400.
- `cscli` argv never contains user input for this endpoint (no path param), so injection boundary is just query rejection.

**Envelope examples:**

Success (HTTP 200):
```json
{ "operation": "hub.list", "result": { "collections": [{"name":"crowdsecurity/base-http-scenarios","version":"0.9.1","latest_version":"0.9.2","status":"update-available","tainted":false}], "parsers": [...], "scenarios": [...], "postoverflows": [...] } }
```

Operation-level failures (HTTP 200):
```json
{ "operation": "hub.list", "error": { "code": "unsupported", "message": "This operation is not supported." } }
{ "operation": "hub.list", "error": { "code": "crowdsec_failure", "message": "The CrowdSec command failed." } }
```

Request-level failures (HTTP 400):
```json
{ "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
```

### 5.2 Hub payload — what `cscli hub list -o json` returns (to validate on host)

Observed shape varies by CrowdSec version; typically:
```json
{
  "collections": [{"name":"crowdsecurity/...","description":"...","version":"...","latest_version":"...","tainted":false,"missing":false}],
  "parsers": [...],
  "scenarios": [...],
  "postoverflows": [...],
  "contexts": [...]
}
```
Some builds emit a flat list with `type` field. **Implementation must handle both** defensively: normalize to `Record<type, HubItem[]>` and fallback to `<pre>` JSON for unknown shapes (same as `Metrics.tsx`).

Validation decision: if `cscli hub list -o json` already contains all types, single `GET /hub` suffices; if not, add `GET /hub/types` that runs `cscli hubtypes list` (name TBD per host `--help`).

### 5.3 `cscli` command contract (backend → subprocess)

| Endpoint | argv (after executable) | Timeout | Stdout handling |
|----------|-------------------------|---------|-----------------|
| `GET /hub` | `["hub","list","-o","json"]` | `cfg.cscli_timeout_seconds` (default 30s) | `json.loads(stdout)` → normalized `HubInventory`; empty `""` → `{"collections":[],"parsers":[],"scenarios":[],"postoverflows":[]}`; malformed → `malformed_output` |
| `GET /hub/types` (if needed) | `["collections","list","-o","json"]` etc. or `["hubtypes","list","-o","json"]` | same | per-type parse |
| Probe #5 | `["hub","list","-o","json"]` | 5.0s | `json.loads` success → `hub.list` supported; else `unsupported` |

No shell, positional argv only. **Never** run `hub update`/`hub upgrade` (writes) — read-only `list` only.

### 5.4 Configuration

No new YAML key. Reuses:
```yaml
cscli:
  executable_path: /usr/bin/cscli   # existing; fallbacks unchanged
  timeout: 30s                      # governs hub handlers and probe
```
Legacy `auth`/`session` blocks remain `extra="ignore"`.

### 5.5 Internal types

Backend:
```python
# backend/envelope.py
HUB_LIST = "hub.list"

# backend/capabilities.py
HUB_OPS = ["hub.list"]  # or inline
# probe_capabilities returns { ..., "hub.list": {"supported": bool} }

# backend/routers/hub/list.py
router = APIRouter(prefix="/hub", tags=["Hub"])
HubItem = TypedDict("HubItem", {"name": str, "description": str, "version": str, "latest_version": str, "tainted": bool, "missing": bool, "status": str})
HubInventory = dict[str, list[HubItem]]
```

Frontend:
```ts
// frontend/src/lib/api/types.ts
export const HUB_LIST = "hub.list";
export type HubItem = { name: string; description?: string; version?: string; latest_version?: string; tainted?: boolean; missing?: boolean; status?: string; type?: string };
export type HubInventory = Record<string, HubItem[]>;

// frontend/src/hooks/useHub.ts
export function useHub(): UseQueryResult<HubInventory>
```

## 6. Ordered Implementation Tasks (with Dependencies and Parallelization)

### Top proposal (#1) — Hub Inventory (shippable in one pass)

| # | Task | Files | Depends on | Parallelizable with |
|---|------|-------|------------|---------------------|
| T1 | **Envelope + capabilities probe** — add `HUB_LIST` label; extend `probe_capabilities` with Probe #5; ensure `GET /capabilities` surfaces 15 ops. | `backend/envelope.py`, `backend/capabilities.py` | — | — |
| T2 | **Hub router** — implement `backend/routers/hub/list.py` with `GET ""` (and optionally `GET "/types"`), query rejection, `CscliRunner.run()` calls, `classify_failure` mapping, JSON parse + `success/operation_error` envelopes, WARN log truncated stderr. | `backend/routers/hub/__init__.py`, `backend/routers/hub/list.py` | T1 | — (small; sequential after T1) |
| T3 | **Wire into app** — import + `api.include_router(hub_router)` in `backend/main.py` before static mount; verify prefix is `/api/v1/hub`. | `backend/main.py` | T2 | — |
| T4 | **Frontend hook + types** — add `HUB_LIST` to `frontend/src/lib/api/types.ts`, implement `frontend/src/hooks/useHub.ts` via `apiGet`. | `frontend/src/lib/api/types.ts`, `frontend/src/hooks/useHub.ts` | T1 | T2/T3 (no file overlap) |
| T5 | **Frontend page + nav** — implement `frontend/src/pages/Hub.tsx` (summary cards + per-type tables + capability badge + states), wire into `frontend/src/App.tsx` / `router.tsx` / `Layout.tsx`. | `frontend/src/pages/Hub.tsx`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx` | T4 | — (after T4) |
| T6 | **Docs** — update `docs/architecture.md` (probes + routes + op list + out-of-scope), `docs/operations-reference.md` (endpoint table + notes), optionally `deploy/config.example.yaml` comment. | `docs/architecture.md`, `docs/operations-reference.md` | T3 + T5 | — |

**Critical path:** T1 → T2 → T3 → T4 → T5 → T6. T4 can start in parallel with T2/T3 (no file overlap) if two agents available; T5 gates on T4. Single agent does T1→T6 sequentially (4 backend files + 5 frontend files + 2 docs).

**Kanban:** `docs/kanban/2026-08-17_hub-inventory/` with `task-01.md`…`task-06.md` if team wants cards (follows `2026-08-16_metrics-endpoint` convention); otherwise implement directly from this plan.

### Other candidates (estimates if selected instead / next)

| Candidate | Tasks (sketch) | Effort |
|---|---|---|
| #2 Simulation | envelope+probe (1), router text-parse (1), hook (1), Overview banner (1), docs (1) | ~0.5d |
| #3 Inspect completion | hooks already exist; 3 dialog/table components + wiring (no backend) | ~0.5d |
| #4 Time-range | query-param extension in 2 routers + FiltersBar date picker + docs | ~0.5–1d |
| #5 Decisions delete | envelope+capability + mutation router with allowlisted `-i/-r/--id` (never `--all`), `classify_failure` reuse, ConfirmDialog + useMutation, audit, docs; needs auth discussion | ~1–2d |

## 7. Acceptance Criteria and Verification

### Backend — manual (from `backend/`, no pytest per lean scope)

```bash
# 1. Boots, probe runs, no stderr leak
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
# logs: Probe #5 line visible; no stack trace

# 2. Health unchanged
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}

# 3. Capabilities now 15 ops, hub.list present
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'hub.list' in d['result']; print('ok', len(d['result']))"
# → ok 15  (was 14)

# 4. Hub — full inventory
curl -s http://127.0.0.1:8090/api/v1/hub | python3 -m json.tool | head -n 60
# → {"operation":"hub.list","result":{"collections":[...],"parsers":[...],...}}
curl -i -s http://127.0.0.1:8090/api/v1/hub | grep -i cache-control
# → cache-control: no-store

# 5. Hub — query rejection (request-level 400, no cscli spawn)
curl -i -s "http://127.0.0.1:8090/api/v1/hub?unknown=1"
# → HTTP/1.1 400 + {"error":{"code":"invalid_parameters", ...}}
curl -i -s "http://127.0.0.1:8090/api/v1/hub?x=1&x=2"  # duplicate key
# → HTTP/1.1 400

# 6. Operation-level failures (degraded mode: stop crowdsec or break executable_path, then)
curl -s http://127.0.0.1:8090/api/v1/hub | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code'] in ('unavailable','unsupported','timeout','crowdsec_failure')"

# 7. Stderr never returned (spot check)
curl -s http://127.0.0.1:8090/api/v1/hub 2>&1 | grep -q "tainted" || echo "ok no leak of raw stderr"

# 8. Static still last — SPA fallback not shadowing /api
curl -s http://127.0.0.1:8090/api/v1/hub | python3 -c "import json,sys; json.load(sys.stdin); print('json ok')"
curl -i -s http://127.0.0.1:8090/unknown-route | head -n 1  # → 200 text/html (SPA fallback)

# 9. Degraded mode — when Probe #5 fails (cscli missing), /hub returns unsupported without spawning
# (rename /usr/bin/cscli, restart dashboard, then curl)
curl -s http://127.0.0.1:8090/api/v1/hub | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code']=='unsupported'"
```

### Frontend — manual (from `frontend/`)

```bash
npm install
npm run typecheck  # → green
npm run build      # → green; dist/index.html + dist/assets/*.js exist

# Dev proxy walk
npm run dev  # vite dev against running uvicorn (proxy /api → 127.0.0.1:8090)
# Visit:
#   /overview still renders
#   /hub renders summary cards (installed count, tainted/missing badges) + per-type tables
#   tainted rows highlighted (amber), missing rows (red), update-available (blue)
#   with cscli missing, CapabilityBadge shows "unsupported" and page disables fetch with explanation
#   no console errors, no leaked stderr strings in UI
```

### Static E2E (with `uv` + built `frontend/dist`)

```bash
curl -i http://127.0.0.1:8090/                     # → 200 text/html no-store
curl -i http://127.0.0.1:8090/assets/*.js         # → 200 immutable
curl -i http://127.0.0.1:8090/unknown-route       # → 200 index.html (SPA fallback)
curl -s http://127.0.0.1:8090/api/v1/hub | python3 -m json.tool  # still works when dist exists
```

### Docs

```bash
grep -n "hub.list" docs/architecture.md docs/operations-reference.md
grep -n "GET.*/hub" docs/operations-reference.md
# no doc references Prometheus /metrics (text) as in-scope beyond explicit distinction
grep -rn "/api/v1/hub" docs/ deploy/ 2>&1 | head
```

## 8. Security, Compatibility, Migration, Operational Considerations

### Security
- **No shell** — `CscliRunner` uses `asyncio.create_subprocess_exec(*cmd)` with positional argv; hub has no path/query params that enter argv, so injection surface is minimal.
- **Query rejection is the boundary** — unknown/duplicate query keys are 400 without spawning, same as `metrics.show`.
- **No stderr in responses** — `result.stderr` WARN-logged truncated ~500 chars, never placed in JSON (`classify_failure` + `SAFE_MESSAGES` only).
- **No auth change** — endpoint inherits loopback-bound, no-session posture; if reverse-proxied, keep behind same mTLS/basic-auth as other `/api/v1/*`.
- **DoS hygiene** — `cscli hub list -o json` payload is bounded (few KB to low 100s KB); `cscli.timeout` applies; no pagination needed.
- **Static precedence** — `/api/v1/hub` on `api` router before `mount_static`; `/api/*` never falls through.

### Compatibility
- **Additive only** — new route under `/api/v1/hub`, new capability key `hub.list`, no change to existing 14 ops, envelope, or error codes.
- **Capabilities size 14 → 15** — frontend reads `caps[op]?.supported` defensively (Overview/ErrorPanel pattern) — safe; no strict length assert.
- **Frontend routing** — new `/hub` client route additive; existing 7 pages untouched. `apiGet` unchanged.
- **Config** — fully backward compatible; old YAMLs with `auth`/`session` still `extra="ignore"`; no new required key.
- **CrowdSec version skew** — `hub list -o json` shape varies; defensive normalization + `<pre>` fallback prevents breakage; probe detects `-o json` availability and degrades to `unsupported` otherwise.

### Migration
- No data migration. No DB. Restart `uvicorn` — probes re-run. If `cscli` absent, `hub.list` is `unsupported` until binary appears and service restarts (same as all other ops).

### Operational
- **Deployment** — single `uvicorn` process, one port (8090), same `deploy/ecosystem.config.cjs` PM2 unit; no new unit.
- **Observability** — WARN logs on `crowdsec_failure/timeout/malformed_output`; Probe #5 log line at startup. No new log format.
- **Capacity** — hub payload modest; no caching beyond startup `supported` flag — live data on every request is intentional.
- **Failure modes** — LAPI down / cscli missing / permission denied / timeout → operation-level envelope with retryable (`timeout`, `unavailable`) vs non-retryable (`permission_denied`, `malformed_output`, `unsupported`); frontend `ErrorPanel` Retry re-issues `GET`.

## 9. Risks, Unresolved Assumptions, and Reviewer Ownership

### Risks
| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | **`cscli hub list -o json` shape varies by version** (flat list vs typed map, field names `tainted`/`missing`/`latest_version`) | High | Low | Normalize defensively; typed helpers with `?.` + fallback `<pre>` JSON; probe proves `-o json` works. |
| R2 | **`hub list` without `-o json` fallback needed on old builds** | Low | Medium | Probe detects it; degrade to `unsupported` — same UX as every other op; document in operations-reference. |
| R3 | **Payload includes many hub items (dozens of parsers/scenarios)** — table could be long | Medium | Low | Per-type tables with default collapsed sections or simple pagination in UI; backend not paginated. |
| R4 | **Confusion: `hub` vs `collections/parsers/scenarios` separate CLIs** | Medium | Low | Docs explicitly map `GET /api/v1/hub` to `cscli hub list -o json`; note that per-type detail is included when available. |
| R5 | **Probe cost +5s at startup** | Low | Low | Same as probes #2–#4; total boot < 20s; could parallelize probes later (out of scope). |

### Assumptions (explicit — confirm before T1)
| # | Assumption | If wrong, plan changes |
|---|------------|------------------------|
| A1 | `cscli hub list -o json` is stable and covers collections/parsers/scenarios/postoverflows in one call (verified via `cscli hub --help` on this host). | If per-type calls needed, add `GET /hub/types` that fans out to `collections list` etc., or extend argv set — add one route + probe. |
| A2 | No new config key wanted; `cscli.timeout` (30s) is acceptable for hub (observed <1s). | If dedicated timeout needed, add `hub.timeout` — excluded now per lean scope. |
| A3 | Single operation label `hub.list` for both `/hub` and `/hub/types` is acceptable (vs `hub.list` + `hubtypes.list`). | If reviewer prefers two labels, split to `hub.list` (snapshot) + `hub.inventory` — add one constant + one probe. |
| A4 | Kanban still date-prefixed `docs/kanban/YYYY-MM-DD_<plan>/` — next board `docs/kanban/2026-08-17_hub-inventory/` if wanted. | If kanban not wanted, implement directly from this plan. |
| A5 | Frontend hub page is desired (read-only). | If API-only preferred, drop T5 and keep T1–T4+T6 (API + docs only). |
| A6 | Host `cscli` version supports `hub list -o json` (CrowdSec ≥1.5). | If older, keep `unsupported` degradation; do not fallback to parsing human output. |

### Reviewer ownership
- **Primary reviewer:** `crowdsec-documentation-reviewer` (wire contract + envelope invariants + docs coherence).
- **Secondary reviewer:** `crowdsec-command-mapper` (probe correctness, argv allowlist, error-code taxonomy, no-shell invariant).

## 10. Alternatives Considered

| Alt | Description | Why not chosen |
|-----|-------------|----------------|
| `GET /api/v1/hub?type=collections` query-param filter | Would avoid second route | Diverges from `metrics.show` path-param precedent and prior `GET /metrics/{component}` shape; hub types are not a filter but inventory — single snapshot is cleaner. |
| `GET /api/v1/collections` + `/parsers` + `/scenarios` as separate top-level routes | Mirrors `cscli collections list` etc. | Three routes + three probes for one dashboard page — overkill; single `/hub` aggregates. |
| Proxy `cscli hub upgrade --dry-run` as status | Would show pending upgrades directly | `--dry-run` semantics vary and may still be state-changing; read-only `list` with `latest_version` diff is safer. |
| Skip hub, ship #2 simulation first | Lower effort, high debug value | Valid but narrower impact; hub answers a broader set of ops questions (tainted, missing, drift) and reuses the same pattern — simulation can follow as a fast follow-up (half-day). |
| Ship #5 decisions delete first | Highest "unblock me" value | Breaks read-only invariant the project explicitly kept for two releases; needs auth/supervision design; higher risk — defer until inventory gaps closed. |

## 11. File Map (final — top proposal)

| Status | Paths |
|--------|-------|
| New | `backend/routers/hub/__init__.py`, `backend/routers/hub/list.py`, `frontend/src/hooks/useHub.ts`, `frontend/src/pages/Hub.tsx` |
| Modified | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `frontend/src/lib/api/types.ts`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/config.py`, `backend/errors.py`, `backend/static.py`, `config.yaml`, `deploy/config.example.yaml`, `deploy/ecosystem.config.cjs` |

## 12. How to Proceed — User Selection

This plan presents **5 ranked candidates**; the user should pick one to implement next. The file itself documents the full ranking and the recommended next step (#1 Hub Inventory).

- **Recommended:** #1 Hub Inventory & Tainted Detection (this plan is already detailed for it — implementation can start on approval).
- **To select a different candidate:** reply with the candidate number/name — the plan will be refined to detail that feature to the same depth (interfaces, tasks, file map, verification) before implementation.
- **If no pick is made:** this research plan remains as the ranked backlog and the recommended next step is #1.
- **Kanban:** on selection, break down the chosen feature into `docs/kanban/2026-08-17_<feature>/task-*.md` via `/plan-task-breakdown`.

## 13. Open Questions for Reviewer

1. Confirm A1: does `cscli hub list -o json` on target hosts already contain all types, or is a second `GET /hub/types` needed?
2. Confirm A3: single `hub.list` label vs split labels.
3. Should empty groups be hidden or rendered as "No data yet"? Plan proposes explicit empty-state row per type.
4. Hub page default: show all types expanded or collapsed with summary counts? Plan proposes summary cards + per-type tables collapsed by default with expand.

---

## Appendix — Verification Checklist (copy into PR description)

- [ ] `uvicorn` boots, Probe #5 logged, `/capabilities` has 15 keys including `hub.list`
- [ ] `GET /api/v1/hub` → 200 `{"operation":"hub.list","result":{...}}` + `no-store`
- [ ] `GET /api/v1/hub?bad=1` → 400 `invalid_parameters`, no `cscli` spawn
- [ ] Stderr never appears in any response body
- [ ] With `cscli` absent, `GET /hub` → 200 `unsupported`
- [ ] `npm run typecheck` + `npm run build` green
- [ ] `/hub` page renders, per-type tables + tainted/missing badges, capability badge degrades correctly
- [ ] Old routes (`/alerts`, `/decisions`, `/bouncers`, `/machines`, `/allowlists`, `/status/*`, `/capabilities`, `/health`, `/metrics`, static SPA) still green
