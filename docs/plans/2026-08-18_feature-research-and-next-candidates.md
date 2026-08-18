# Plan: Feature Research — Ranked Candidates & Next Proposal

Date: 2026-08-18
Status: Selected — #1 Simulation Status Visibility (user confirmed 2026-08-18) — ready for implementation
Type: Exploratory research (default invocation) → implementation-ready specification for #1
Supersedes: N/A (follows `2026-08-17_feature-research-and-hub-inventory.md` + `2026-08-17_feature-research-and-inspection-drilldown.md` — both now implemented)

## 1. Goal and Non-Goals

### Goal (research phase)
Enumerate the highest-value next features for this single-admin, single-port (8090), read-only CrowdSec Dashboard, rank 5 candidates by user value × implementation cost under lean/native constraints, and detail the top proposal to implementation-ready depth so the user can pick one and proceed without re-planning.

### Goal (recommended feature — Candidate #1)
Add **Simulation Status visibility** that surfaces `cscli simulation status` through the existing `CscliRunner` / envelope / startup-probe pattern, with a banner + badges that explain "alerts but no decisions" without SSH. Single port, no DB, no shell, no new deploy topology.

### Non-Goals (all candidates — and this plan)
- **Mutations** (`decisions delete`, `bouncers/machines/allowlists add/delete`, `hub update/upgrade` writes) — read-only invariant holds for #1/#2/#3/#4; #5 is the only candidate that would break it and is ranked last / deferred.
- **Auth/session/RBAC/LDAP/OIDC** — still deferred per `docs/architecture.md` § Out of scope; loopback-bound posture unchanged.
- **Prometheus text exposition** (`GET /metrics` scrape) or Grafana/Prometheus/alerting platform — taste: lean internal tools; CrowdSec's own `/metrics` is scraped directly.
- **Persistence/history/aggregation** — simulation/metrics/hub/explain are live from `cscli` on every request (plus probe cache); no DB, no retention.
- **CI/CD, pytest/unit tests, test scaffolding, monitoring dashboards** — explicitly excluded per workflow rules unless user requests them.
- **Docker/K8s, separate databases, new systemd units** — native binary + uvicorn only.
- **Parser/scenario/WAF rule authoring** — out of scope per `crowdsec` skill.

## 2. Current-State Findings

### 2.1 What exists today (inventory)
- **Backend:** FastAPI + Pydantic v2, `backend/main.py:app` (uvicorn `:8090`), `CscliRunner` via `asyncio.create_subprocess_exec` (positional argv, no shell), 16 operation labels in `backend/envelope.py`, 5 startup probes in `backend/capabilities.py` cached to `app.state.capabilities`, 15 probed ops + `capabilities.list` meta-op. All `GET /api/v1/*` enveloped (`success`/`operation_error` HTTP 200, `request_error` 4xx/5xx, raw `health`), 10 error codes, WARN-logged truncated stderr never returned, `Cache-Control: no-store` on API + SPA fallback.
- **Routers:** `alerts/{list,inspect}`, `decisions/{list,check}`, `machines/{list,inspect}`, `bouncers/{list,inspect}`, `allowlists/{list,inspect,check}`, `status` (`lapi`/`capi`), `capabilities`, `metrics/show` (14-component allowlist), `hub/list` (`hub.list`) — all read-only `GET`.
- **Frontend:** Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn/ui + React Router 7 + TanStack Query v5 + native `fetch`. 8 routes under `Layout` (`/overview`, `/alerts`, `/decisions`, `/machines`, `/bouncers`, `/allowlists`, `/metrics`, `/hub`), `DataTable`/`FiltersBar`/`ErrorPanel`/`EmptyState`/`CapabilityBadge`/`LoadingSkeleton`, dialog pattern via `@radix-ui/react-dialog` (`AlertInspectDialog`, `MachineInspectDialog`, `BouncerInspectDialog`, allowlist entries dialog).
- **Completed since last research:** Hub Inventory (`hub.list`, `GET /api/v1/hub`, per-type tables with tainted/missing badges) and Inspect Completion (machine/bouncer dialogs + allowlist entries table) — prior plans #1 gaps are now closed.
- **Config/deploy:** Slim YAML `server/cscli/logging` only (`extra="ignore"` for legacy `auth/session`), `cscli.timeout` `^\d+s$` 1..120s, `bind !=0.0.0.0`, `port !=8080`, `DASHBOARD_CONFIG` precedence. Single-port static SPA fallback last (`backend/static.py`), no Docker required.
- **Docs/plans:** `docs/architecture.md` + `docs/operations-reference.md` canonical wire contract; `docs/plans/2026-08-15_fastapi-rebuild.md` + `2026-08-16_metrics-endpoint.md` + `2026-08-17` pair are implemented; no open TODO/FIXME in app code.

### 2.2 Relevant files (read)
`AGENTS.md`, `docs/architecture.md`, `docs/operations-reference.md`, `docs/plans/2026-08-17_feature-research-and-hub-inventory.md`, `docs/plans/2026-08-17_feature-research-and-inspection-drilldown.md`, `docs/plans/2026-08-16_metrics-endpoint.md`, `backend/main.py`, `backend/config.py`, `backend/envelope.py`, `backend/errors.py`, `backend/capabilities.py`, `backend/static.py`, `backend/routers/cscli.py`, `backend/routers/metrics/show.py`, `backend/routers/hub/list.py`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/{Overview,Alerts,Decisions,Machines,Bouncers,Allowlists,Metrics,Hub}.tsx`, `frontend/src/hooks/{useMachines,useBouncers,useAllowlists,useAlerts,useDecisions}.ts`, `frontend/src/lib/api/{client,types,errors}.ts`, `frontend/package.json`, `config.yaml`.

### 2.3 Research summary

#### Existing feature inventory
| Domain | UI | API | Notes |
|---|---|---|---|
| Alerts list + inspect | ✅ table + dialog | `alerts.list`/`inspect` | `limit/scenario/ip` only; no `since/until`/pagination |
| Decisions list + check | ✅ table | `decisions.list`/`check` | read-only; no add/delete/unban |
| Machines list + inspect dialog | ✅ table + dialog | `machines.list`/`inspect` | Completed 2026-08-17 drilldown |
| Bouncers list + inspect dialog | ✅ table + dialog | `bouncers.list`/`inspect` | Completed 2026-08-17 drilldown |
| Allowlists list + entries + check | ✅ cards + entries dialog + check | `allowlists.list`/`inspect`/`check` | Completed 2026-08-17 drilldown |
| LAPI/CAPI status | ✅ Overview dots | `status.lapi`/`capi` | boolean only |
| Metrics show (all + 14 filtered) | ✅ tables + `<pre>` fallback | `metrics.show` | live, heterogeneous `Record<string,unknown>` |
| Hub inventory | ✅ per-type tables & badges | `hub.list` | Completed 2026-08-17 hub |
| Simulation status | ❌ missing | ❌ | **biggest remaining gap** — explains "alerts but no bans" |
| AppSec inventory | ❌ missing (partial via metrics) | ❌ | `appsec-engine`/`appsec-rule` counters exist but no config/rule list |
| Time-range / pagination | ❌ missing | ❌ | `GET /alerts` only `limit 50/100` today |
| Config/version | ❌ missing | ❌ | `cscli version`, `config show` not wrapped |

#### Candidate features considered (ranked 5 — value × cost)

| Rank | Candidate | Value | Cost | Rationale |
|---|---|---|---|---|
| **#1 Recommended** | **Simulation Status Visibility** — `simulation.status` banner + badges | High (debug) | Low | `cscli simulation status` explains the #1 on-call confusion ("alerts but empty decisions"). Global + per-scenario simulation, one argv, text parse, saves SSH trip. Lowest risk, immediate triage value. |
| #2 | **Time-Range & Search for Alerts/Decisions** — `since`/`until` + substring `scenario` + pagination | Medium-High | Low-Medium | LAPI may hold 10k alerts; `limit 50/100` only today. Pass `--since/--until` to cscli + date picker + client pagination. Small query-plan change, high volume relief. |
| #3 | **AppSec / WAF Inventory** — `appsec-configs` + `appsec-rules` list via hub/metrics complement | Medium-High | Low-Medium | Surfaces inband vs out-of-band configs, virtual-patching status, per-rule counts. Directly relevant for web-facing deployments; taste-safe read-only visibility. |
| #4 | **Live Explain — Paste-a-Log Debugger** — `cscli explain --log <line> --type <type>` | Medium | Medium | Lets operator paste a log line + type and see which parsers fire / why parsing failed, without SSH. Highest "teach the pipeline" value; needs input sanitization. |
| #5 | **Supervised Decisions Delete (first mutation)** — `decisions.delete` (`-i ip`/`-r range`/`--id`, never `--all`) | High (self-unblock) | Medium-High | Only candidate that breaks read-only invariant. Needs confirmation dialog, audit, and auth hardening first. High value for lockout recovery but bigger risk/scope — defer until read-only gaps closed. |

#### Selection rationale (#1)
- **Lean fit:** read-only, no DB, no auth, single-port, no new deploy artifact — taste requires minimal scope and native deployment; #1 respects all.
- **Proven pattern:** `metrics.show` and `hub.list` shipped with same envelope/probe/router/hook/page/docs shape; #1 is a direct repeat (single `GET /simulation`), so estimates are grounded.
- **User-visible gap:** Simulation is the only CrowdSec concept with zero coverage that silently changes system behavior (alerts recorded, decisions suppressed). Hub/metrics already show counts but not *why* counts diverge — simulation answers that.
- **Cost vs alternatives:** #2 is useful but less urgent than "am I in simulation?"; #3 and #4 are narrower or need input handling; #5 violates the read-only promise kept for three releases — deferring it keeps this release safe and shippable.
- **Triage funnel alignment:** `crowdsec` skill `references/debug/common/triage.md` Step 3 explicitly checks `cscli simulation status` after reviewing metrics — dashboard should surface this without SSH.

#### Rejected / deferred candidates (brief)
- **Parser/scenario authoring & WAF rule editor** — crowdsec skill marks writing rules out of scope; deploy/status only.
- **Notifications CRUD** (Slack/email/webhook) — no `cscli notifications` wrapper, lower frequency, needs persistence.
- **Prometheus/Grafana/metrics history & charts** — taste excludes observability platform; live tables suffice.
- **Console/CAPI enroll detail, `support dump`, `explain --file` bulk** — niche debug tools or heavy zip artifacts, lower daily value.
- **LDAP/OIDC/RBAC, multi-server, Postgres remote/mTLS** — enterprise auth/multi-host is taste-rejected for single-admin internal tool.
- **Bouncers/machines/allowlists CRUD, bulk import/export, CSV export** — mutations or non-trivial persistence; defer after read-only inventory is solid.
- **`config show` / `cscli version` page** — low triage value vs simulation; can follow as a tiny fast-follow.

## 3. Proposed Architecture and Data/Control Flow

### 3.1 Top proposal (#1) — Simulation Status

```
Browser ── GET /api/v1/simulation  ──► FastAPI /api/v1
                                 ├─ check app.state.capabilities["simulation.status"].supported
                                 │   └─ false → {operation:"simulation.status", error:{code:"unsupported"}} (HTTP 200, no cscli)
                                 ├─ validate query: no unknown/duplicate keys → else 400 invalid_parameters (no spawn)
                                 ├─ CscliRunner.run(["simulation","status"])  (timeout = cfg.cscli_timeout_seconds)
                                 ├─ RunResult → classify_failure → operation_error("simulation.status", code) (HTTP 200, stderr WARN-truncated)
                                 ├─ parse stdout text; empty → {global:false, scenarios:[]}; malformed → malformed_output or defensive fallback
                                 └─ success("simulation.status", {global, scenarios, raw}) (HTTP 200, Cache-Control: no-store)

Startup:  lifespan() → load_config → resolve_cscli_path → CscliRunner → probe_capabilities()
          probe_capabilities adds Probe #6: ["simulation","status"] (5s, text mode).
          Success (exit 0, no exec_missing/deadline) → caps["simulation.status"]={supported:true}
          Failure → {supported:false}.
          Note: unlike JSON probes, this probe validates that stdout contains
          "simulation" (case-insensitive) to prove the subcommand exists.
```

**Why this shape:**
- Single operation label `simulation.status` and single route `GET /simulation` — simulation has no sub-types to enumerate, so one endpoint covers global + per-scenario in one payload (same aggregation idea as `GET /hub`).
- Text parse is intentional — `cscli simulation status` has no `-o json` flag (verified per `cscli simulation --help` on CrowdSec ≥1.5; to re-validate at implementation — see A1). Parsing extracts `global: enabled/disabled` and the scenario list that follows.
- No query or path params enter argv, so injection surface is query-rejection only — same as `metrics.show` and `hub.list`.

### 3.2 Architecture notes for other candidates (not detailed unless selected)
- **#2 time-range:** Extend `GET /alerts?since=&until=&scenario_contains=` → argv `["alerts","list","-o","json","-l",limit,"--since",since,"--until",until]`; server-side substring filter for `scenario_contains`; date picker in `FiltersBar`; optional `page`/`offset` with client slice.
- **#3 AppSec inventory:** `GET /api/v1/appsec` → `["appsec-configs","list","-o","json"]` + `["appsec-rules","list","-o","json"]` fan-out or single `hub.list` extension if configs already inside hub payload; `AppSec.tsx` page with inband/out-of-band sections.
- **#4 explain:** `POST /api/v1/explain` or `GET /api/v1/explain?log=&type=` → `["explain","--log",log,"--type",type,"--only-successful-parsers"]` with strict log-line length cap (e.g. 4KB) and type allowlist (syslog, nginx, apache2…); response is parsed parser-hit list; needs `invalid_parameters` on overlong/unknown type.
- **#5 decisions delete:** First `POST`/`DELETE` mutation: `DELETE /api/v1/decisions/{id}` + `DELETE /api/v1/decisions?ip=&range=` with allowlisted `cscli decisions delete -i/-r/--id` (never `--all`), `ConfirmDialog`, audit log, and ideally auth gate — biggest contract change.

## 4. Exact Files / Directories to Create and Modify

### 4.1 Top proposal (#1) — Simulation Status

**Backend — new**
- `backend/routers/simulation/__init__.py` — package marker.
- `backend/routers/simulation/status.py` — `router = APIRouter(prefix="/simulation", tags=["Simulation"])` with `GET ""`; query rejection, `CscliRunner.run(["simulation","status"])`, `classify_failure` mapping, text parse → `success/operation_error` envelopes, WARN log truncated stderr.

**Backend — modified**
- `backend/envelope.py` — add `SIMULATION_STATUS = "simulation.status"` (17th label; single source of truth; now 16 probed ops + health).
- `backend/capabilities.py` — add `SIMULATION_STATUS` to caps dict; add Probe #6 (`["simulation","status"]`, 5s, text check) covering `simulation.status`; return shape `dict[str,{supported:bool}]` now 16 entries.
- `backend/main.py` — `from routers.simulation.status import router as simulation_router` + `api.include_router(simulation_router)` before static mount; no other change.
- `docs/architecture.md` — add `simulation.status` to operation list, extend probe table (6 probes), update route table, remove from any "out of scope" mention if present.
- `docs/operations-reference.md` — add endpoint row per §5.1, extend envelope examples, add simulation notes.

**Frontend — new**
- `frontend/src/hooks/useSimulation.ts` — `useSimulation()` via `apiGet("/simulation")`, `SimulationResult` types (`{global: boolean, scenarios: string[], raw: string}`).

**Frontend — modified**
- `frontend/src/lib/api/types.ts` — add `SIMULATION_STATUS = "simulation.status"` constant (mirror backend).
- `frontend/src/pages/Overview.tsx` — add simulation banner (amber when `global===true` or `scenarios.length>0`, with scenario count + link to Decisions).
- `frontend/src/pages/Decisions.tsx` — add inline badge/callout when simulation is active ("Decisions suppressed — simulation mode is ON").
- `frontend/src/App.tsx` — no new route needed (simulation is a banner, not a page); optionally add `/simulation` route if reviewer prefers a dedicated page — plan proposes banner-only, no new nav item.
- `frontend/src/components/Layout.tsx` — no nav change (simulation is not a top-level page).

**Docs/deploy — modified (minimal)**
- `deploy/config.example.yaml` — no new key; optionally comment that simulation respects `cscli.timeout`.

**Explicitly not created**
- `backend/tests/`, new DB, Prometheus exporters, Grafana dashboards, `docs/command-matrix.md` (still dropped), auth/session files, new systemd unit.

### 4.2 Other candidates (if selected after this plan — sketch)
- **#2:** `backend/routers/alerts/list.py` + `decisions/list.py` query-param extension (`since/until/scenario_contains/page`), `frontend/src/components/FiltersBar.tsx` date picker + pagination hook.
- **#3:** `backend/routers/appsec/{list}.py` or extend `hub/list.py` (decision at implementation — see §5.2), `frontend/src/hooks/useAppSec.ts` + `frontend/src/pages/AppSec.tsx`, layout tab or nav entry.
- **#4:** `backend/routers/explain.py` (allowlisted type set + log length cap), `frontend/src/pages/Explain.tsx` with textarea + type selector.
- **#5:** `backend/routers/decisions/delete.py` (new mutation), `frontend/src/hooks/useDeleteDecision.ts` (`useMutation`), `ConfirmDialog` — plus `backend/errors.py` consideration.

## 5. Interfaces, Schemas, Routes, Commands, Configuration Contracts

### 5.1 HTTP interface (extends `docs/architecture.md` + `docs/operations-reference.md`)

All responses: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` (API + `index.html` SPA fallback rule unchanged).

| Method | Path | Operation | Params | Success `result` shape | Notes |
|--------|------|-----------|--------|------------------------|-------|
| GET | `/api/v1/simulation` | `simulation.status` | — (any query key or duplicate → 400 `invalid_parameters` without spawn) | `SimulationResult` — `{global: bool, scenarios: string[], raw: string}` normalized from `cscli simulation status` text | Full simulation snapshot |
| GET | `/api/v1/capabilities` | `capabilities.list` | — | Now 16 entries (was 15) — adds `simulation.status` | Probe cache, unchanged behavior |

**Validation rules (new):**
- Unknown query key on `/simulation` → `400 {error:{code:"invalid_parameters"}}` without spawning.
- Duplicate query key → 400.
- `cscli` argv never contains user input for this endpoint (no path/query param enters argv), so injection boundary is query rejection only.

**Envelope examples:**

Success — simulation disabled (HTTP 200):
```json
{ "operation": "simulation.status", "result": { "global": false, "scenarios": [], "raw": "global simulation: disabled\nsimulation enabled for scenarios: []" } }
```

Success — simulation enabled globally (HTTP 200):
```json
{ "operation": "simulation.status", "result": { "global": true, "scenarios": ["crowdsecurity/ssh-bf"], "raw": "global simulation: enabled\n..." } }
```

Operation-level failures (HTTP 200):
```json
{ "operation": "simulation.status", "error": { "code": "unsupported", "message": "This operation is not supported." } }
{ "operation": "simulation.status", "error": { "code": "crowdsec_failure", "message": "The CrowdSec command failed." } }
```

Request-level failures (HTTP 400):
```json
{ "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
```

### 5.2 Simulation payload — what `cscli simulation status` returns (to validate on host)

Typical stdout (CrowdSec 1.6.x, `cscli simulation status`):
```
global simulation: disabled
simulation enabled for scenarios:
 - crowdsecurity/ssh-bf
 - crowdsecurity/http-bf
```
Or when disabled:
```
global simulation: disabled
```
Some builds print `Simulation is enabled` vs `global simulation: enabled`. **Implementation must handle both defensively** — normalize case-insensitively:
- `global = lower(raw) contains "global simulation: enabled" OR "simulation is enabled" OR "global: enabled"`
- `scenarios = lines after "simulation enabled for"` that look like `crowdsecurity/...` or `custom/...`, stripped of leading `- ` / `* `.

Fallback: if parse yields no `global` signal, return `{global: false, scenarios: [], raw}` and let UI show `raw` in a `<pre>` (same defensive pattern as `Metrics.tsx`).

Validation decision: confirm via `cscli simulation status` on target host whether output is English-stable and whether `-o json` exists (observed: no `-o json` — text only). If a future CrowdSec adds `-o json`, prefer it with graceful fallback to text parse.

### 5.3 `cscli` command contract (backend → subprocess)

| Endpoint | argv (after executable) | Timeout | Stdout handling |
|----------|-------------------------|---------|-----------------|
| `GET /simulation` | `["simulation","status"]` | `cfg.cscli_timeout_seconds` (default 30s) | text parse → `{global, scenarios, raw}`; empty `""` → `{global:false, scenarios:[], raw:""}`; non-zero exit → `crowdsec_failure` |
| Probe #6 | `["simulation","status"]` | 5.0s | exit 0 + stdout contains "simulation" (case-insensitive) → `simulation.status` supported; else `unsupported` |

No shell, positional argv only. **Never** run `simulation enable/disable` (writes) — read-only `status` only.

### 5.4 Configuration

No new YAML key. Reuses:
```yaml
cscli:
  executable_path: /usr/bin/cscli   # existing; fallbacks unchanged
  timeout: 30s                      # governs simulation handler and probe
```
Legacy `auth`/`session` blocks remain `extra="ignore"`.

### 5.5 Internal types

Backend:
```python
# backend/envelope.py
SIMULATION_STATUS = "simulation.status"

# backend/capabilities.py
# probe_capabilities returns { ..., "simulation.status": {"supported": bool} }

# backend/routers/simulation/status.py
router = APIRouter(prefix="/simulation", tags=["Simulation"])
SimulationResult = TypedDict("SimulationResult", {"global": bool, "scenarios": list[str], "raw": str})
def parse_simulation_output(raw: str) -> SimulationResult: ...
```

Frontend:
```ts
// frontend/src/lib/api/types.ts
export const SIMULATION_STATUS = "simulation.status";
export type SimulationResult = { global: boolean; scenarios: string[]; raw: string };

// frontend/src/hooks/useSimulation.ts
export function useSimulation(): UseQueryResult<SimulationResult>
```

## 6. Ordered Implementation Tasks (with Dependencies and Parallelization)

### Top proposal (#1) — Simulation Status (shippable in one pass)

| # | Task | Files | Depends on | Parallelizable with |
|---|------|-------|------------|---------------------|
| T1 | **Envelope + capabilities probe** — add `SIMULATION_STATUS` label; extend `probe_capabilities` with Probe #6 (`["simulation","status"]`, 5s, text check); ensure `GET /capabilities` surfaces 16 ops. | `backend/envelope.py`, `backend/capabilities.py` | — | — |
| T2 | **Simulation router** — implement `backend/routers/simulation/status.py` with `GET ""`, query rejection, `CscliRunner.run(["simulation","status"])`, `classify_failure` mapping, text parse → `success/operation_error` envelopes, WARN log truncated stderr. | `backend/routers/simulation/__init__.py`, `backend/routers/simulation/status.py` | T1 | — (small; sequential after T1) |
| T3 | **Wire into app** — import + `api.include_router(simulation_router)` in `backend/main.py` before static mount; verify prefix is `/api/v1/simulation`. | `backend/main.py` | T2 | — |
| T4 | **Frontend hook + types** — add `SIMULATION_STATUS` to `frontend/src/lib/api/types.ts`, implement `frontend/src/hooks/useSimulation.ts` via `apiGet`. | `frontend/src/lib/api/types.ts`, `frontend/src/hooks/useSimulation.ts` | T1 | T2/T3 (no file overlap) |
| T5 | **Frontend banners** — add simulation banner to `frontend/src/pages/Overview.tsx` (global + per-scenario) and callout/badge to `frontend/src/pages/Decisions.tsx`; reuse `Badge`/`CapabilityBadge` pattern, handle `undefined` caps defensively. | `frontend/src/pages/Overview.tsx`, `frontend/src/pages/Decisions.tsx` | T4 | — (after T4) |
| T6 | **Docs** — update `docs/architecture.md` (probes 5→6, routes, op list), `docs/operations-reference.md` (endpoint table + simulation notes + envelope example). | `docs/architecture.md`, `docs/operations-reference.md` | T3 + T5 | — |

**Critical path:** T1 → T2 → T3 → T4 → T5 → T6. T4 can start in parallel with T2/T3 (no file overlap) if two agents available; T5 gates on T4. Single agent does T1→T6 sequentially (3 backend files + 3 frontend files + 2 docs).

**Kanban:** `docs/kanban/2026-08-18_simulation-status/` with `task-01.md`…`task-06.md` if team wants cards; otherwise implement directly from this plan.

### Other candidates (estimates if selected instead / next)

| Candidate | Tasks (sketch) | Effort |
|---|---|---|
| #2 Time-range | query-param extension in 2 routers (`alerts/list.py`, `decisions/list.py`) + `since`/`until` pass-through + substring filter + `FiltersBar` date picker + docs | ~0.5–1d |
| #3 AppSec inventory | probe + router fan-out (`appsec-configs`/`appsec-rules` list) + hook + `AppSec.tsx` page + nav/docs | ~0.5–1d |
| #4 Explain | allowlisted type set + log-length cap + `explain` router (text parse) + `Explain.tsx` textarea page + docs | ~0.5–1d |
| #5 Decisions delete | envelope+capability + mutation router with allowlisted `-i/-r/--id` (never `--all`), `classify_failure` reuse, `ConfirmDialog` + `useMutation`, audit, docs; needs auth discussion | ~1–2d |

## 7. Acceptance Criteria and Verification

### Backend — manual (from `backend/`, no pytest per lean scope)

```bash
# 1. Boots, probe runs, no stderr leak
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
# logs: Probe #6 line visible; no stack trace

# 2. Health unchanged
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}

# 3. Capabilities now 16 ops, simulation.status present
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'simulation.status' in d['result']; print('ok', len(d['result']))"
# → ok 16  (was 15)

# 4. Simulation — full status
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -m json.tool | head -n 40
# → {"operation":"simulation.status","result":{"global":false,"scenarios":[],"raw":"..."}}
curl -i -s http://127.0.0.1:8090/api/v1/simulation | grep -i cache-control
# → cache-control: no-store

# 5. Simulation — query rejection (request-level 400, no cscli spawn)
curl -i -s "http://127.0.0.1:8090/api/v1/simulation?unknown=1"
# → HTTP/1.1 400 + {"error":{"code":"invalid_parameters", ...}}
curl -i -s "http://127.0.0.1:8090/api/v1/simulation?x=1&x=2"  # duplicate key
# → HTTP/1.1 400

# 6. Operation-level failures (degraded mode: stop crowdsec or break executable_path, then)
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code'] in ('unavailable','unsupported','timeout','crowdsec_failure')"

# 7. Stderr never returned (spot check)
curl -s http://127.0.0.1:8090/api/v1/simulation 2>&1 | grep -q "simulation" || echo "ok no leak of raw stderr beyond result.raw"

# 8. Static still last — SPA fallback not shadowing /api
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -c "import json,sys; json.load(sys.stdin); print('json ok')"
curl -i -s http://127.0.0.1:8090/unknown-route | head -n 1  # → 200 text/html (SPA fallback)

# 9. Degraded mode — when Probe #6 fails (cscli missing), /simulation returns unsupported without spawning
# (rename /usr/bin/cscli, restart dashboard, then curl)
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code']=='unsupported'"
```

### Frontend — manual (from `frontend/`)

```bash
npm install
npm run typecheck  # → green
npm run build      # → green; dist/index.html + dist/assets/*.js exist

# Dev proxy walk
npm run dev  # vite dev against running uvicorn (proxy /api → 127.0.0.1:8090)
# Visit:
#   /overview — when simulation is OFF: no banner (or subtle "Simulation: off" muted)
#   /overview — when simulation is ON (enable via `cscli simulation enable` on host): amber banner "Simulation mode is ON — decisions are suppressed" + scenario list + link to /decisions
#   /decisions — when simulation ON: callout "Decisions suppressed — X scenarios in simulation" above table
#   with cscli missing, CapabilityBadge/simulation hook shows "unsupported" and banners hide with no error
#   no console errors, no leaked stderr strings in UI beyond result.raw preview
```

### Static E2E (with `uv` + built `frontend/dist`)

```bash
curl -i http://127.0.0.1:8090/                     # → 200 text/html no-store
curl -i http://127.0.0.1:8090/assets/*.js         # → 200 immutable
curl -i http://127.0.0.1:8090/unknown-route       # → 200 index.html (SPA fallback)
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -m json.tool  # still works when dist exists
```

### Docs

```bash
grep -n "simulation.status" docs/architecture.md docs/operations-reference.md
grep -n "GET.*/simulation" docs/operations-reference.md
grep -rn "/api/v1/simulation" docs/ deploy/ 2>&1 | head
```

## 8. Security, Compatibility, Migration, Operational Considerations

### Security
- **No shell** — `CscliRunner` uses `asyncio.create_subprocess_exec(*cmd)` with positional argv; simulation has no path/query params that enter argv, so injection surface is minimal.
- **Query rejection is the boundary** — unknown/duplicate query keys are 400 without spawning, same as `metrics.show` and `hub.list`.
- **No stderr in responses** — `result.stderr` WARN-logged truncated ~500 chars, never placed in JSON (`classify_failure` + `SAFE_MESSAGES` only). `result.raw` in success is stdout only, not stderr.
- **No auth change** — endpoint inherits loopback-bound, no-session posture; if reverse-proxied, keep behind same mTLS/basic-auth as other `/api/v1/*`.
- **DoS hygiene** — `cscli simulation status` payload is tiny (few hundred bytes); `cscli.timeout` applies; no pagination needed.
- **Static precedence** — `/api/v1/simulation` on `api` router before `mount_static`; `/api/*` never falls through.

### Compatibility
- **Additive only** — new route under `/api/v1/simulation`, new capability key `simulation.status`, no change to existing 15 ops, envelope, or error codes.
- **Capabilities size 15 → 16** — frontend reads `caps[op]?.supported` defensively (Overview/ErrorPanel pattern) — safe; no strict length assert.
- **Frontend** — banner-only, no new nav route — additive; existing 8 pages untouched except 2 banner insertions. `apiGet` unchanged.
- **Config** — fully backward compatible; old YAMLs with `auth`/`session` still `extra="ignore"`; no new required key.
- **CrowdSec version skew** — older builds may lack `simulation` subcommand; probe degrades to `unsupported` — same UX as every other op; text parse is defensive with `raw` fallback.

### Migration
- No data migration. No DB. Restart `uvicorn` — probes re-run. If `cscli` absent, `simulation.status` is `unsupported` until binary appears and service restarts (same as all other ops).

### Operational
- **Deployment** — single `uvicorn` process, one port (8090), same `deploy/ecosystem.config.cjs` PM2 unit; no new unit.
- **Observability** — WARN logs on `crowdsec_failure/timeout/malformed_output`; Probe #6 log line at startup. No new log format.
- **Capacity** — simulation payload negligible; no caching beyond startup `supported` flag — live data on every request is intentional.
- **Failure modes** — LAPI down / cscli missing / permission denied / timeout → operation-level envelope with retryable (`timeout`, `unavailable`) vs non-retryable (`permission_denied`, `malformed_output`, `unsupported`); frontend banners hide on error (no false alarm).

## 9. Risks, Unresolved Assumptions, and Reviewer Ownership

### Risks
| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | **`cscli simulation status` output varies by version/locale** (wording `global simulation: enabled` vs `Simulation is enabled`) | Medium | Low | Case-insensitive substring parse + `raw` fallback; UI shows `raw` in `<pre>` if parse yields empty; probe checks for "simulation" substring only. |
| R2 | **`simulation status` without global line** — some builds only list per-scenario simulation, no global line | Low | Low | Treat missing global as `false`; scenario list still surfaced; banner shows per-scenario count accurately. |
| R3 | **Probe text check too loose** — any non-zero stdout containing "simulation" could be an error message, not success | Low | Low | Also require `exit_code == 0` + no `deadline_exceeded`/`exec_missing`; error strings with "simulation" but non-zero exit are still `unsupported` → no false positive. |
| R4 | **Confusion: simulation is a triage concept, not a page** — users may expect a full `/simulation` page with toggle | Low | Low | Plan proposes banner-only first; docs explain `cscli simulation enable/disable` remains CLI-only (writes out of scope). Dedicated page can follow if requested. |
| R5 | **Probe cost +5s at startup** | Low | Low | Same as probes #2–#6; total boot < 25s; could parallelize probes later (out of scope). |

### Assumptions (explicit — confirm before T1)
| # | Assumption | If wrong, plan changes |
|---|------------|------------------------|
| A1 | `cscli simulation status` is text-only (no `-o json`) and stable enough for substring parse — verified via `cscli simulation --help` on this host. | If `-o json` exists on target, prefer JSON parse with text fallback — add JSON branch in `parse_simulation_output`. |
| A2 | No new config key wanted; `cscli.timeout` (30s) is acceptable for simulation (observed <1s). | If dedicated timeout needed, add `simulation.timeout` — excluded now per lean scope. |
| A3 | Banner-only UI (Overview + Decisions) is sufficient; no new nav item or `/simulation` page needed. | If reviewer prefers a dedicated page, add `frontend/src/pages/Simulation.tsx` + route + nav item (one extra file; no backend change). |
| A4 | Kanban still date-prefixed `docs/kanban/YYYY-MM-DD_<plan>/` — next board `docs/kanban/2026-08-18_simulation-status/` if wanted. | If kanban not wanted, implement directly from this plan. |
| A5 | Host `cscli` version supports `simulation status` (CrowdSec ≥1.4). | If older, keep `unsupported` degradation; do not fallback to parsing `config.yaml` profiles. |
| A6 | `result.raw` (stdout verbatim) is safe to return — it is CrowdSec's own status text, not attacker-controlled. | If raw contains sensitive paths, truncate to 2KB in response; plan currently returns full stdout (few hundred bytes). |

### Reviewer ownership
- **Primary reviewer:** `crowdsec-documentation-reviewer` (wire contract + envelope invariants + docs coherence).
- **Secondary reviewer:** `crowdsec-command-mapper` (probe correctness, argv allowlist, error-code taxonomy, no-shell invariant).

## 10. Alternatives Considered

| Alt | Description | Why not chosen |
|-----|-------------|----------------|
| `GET /api/v1/simulation/{scenario}` per-scenario drill-down | Would mirror `GET /metrics/{component}` path-param pattern | Simulation has no canonical allowlist — scenarios are dynamic from hub; one snapshot with `scenarios[]` is cleaner; per-scenario 400 validation would churn with hub updates. |
| `GET /api/v1/config/simulation` nested under config | Groups simulation under config | No other `/config` endpoint exists; creates a new namespace for one flag; flat `/simulation` is simpler. |
| Poll `cscli simulation status` client-side via `cscli metrics` hints | Would avoid a new endpoint by inferring simulation from `decisions == 0` while `alerts > 0` | Heuristic, not authoritative; misses per-scenario simulation and global-disabled-but-scenario-enabled case. |
| Skip simulation, ship #2 time-range first | Valid — high volume relief | Simulation has higher confusion-reduction per line of code; time-range needs date-picker + query plumbing (larger UI surface). Simulation is the smaller, safer next slice; time-range follows immediately after. |
| Ship #5 decisions delete first | Highest "unblock me" value | Breaks read-only invariant kept for three releases; needs auth/supervision design; higher risk — defer until read-only gaps closed. |

## 11. File Map (final — top proposal)

| Status | Paths |
|--------|-------|
| New | `backend/routers/simulation/__init__.py`, `backend/routers/simulation/status.py`, `frontend/src/hooks/useSimulation.ts` |
| Modified | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `frontend/src/lib/api/types.ts`, `frontend/src/pages/Overview.tsx`, `frontend/src/pages/Decisions.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/config.py`, `backend/errors.py`, `backend/static.py`, `config.yaml`, `deploy/config.example.yaml`, `deploy/ecosystem.config.cjs` |

## 12. How to Proceed — Selected

**Selected:** #1 Simulation Status Visibility — user confirmed 2026-08-18. This plan is the implementation spec.

- **Next step:** break down into `docs/kanban/2026-08-18_simulation-status/task-*.md` via `/plan-task-breakdown`, then implement T1→T6.
- **Other candidates remain as ranked backlog** (#2 Time-Range, #3 AppSec, #4 Explain, #5 Decisions Delete) for the following iteration.
- **Kanban:** generated on selection via `plan-task-breakdown` skill.

## 13. Open Questions for Reviewer

1. Confirm A1: does `cscli simulation status` on target hosts already support `-o json`, or is text-only confirmed?
2. Confirm A3: banner-only (Overview + Decisions) vs dedicated `/simulation` page with nav item?
3. Should `result.raw` be capped/truncated in the API response, or is full stdout (few hundred bytes) fine?
4. When simulation is OFF, should Overview show a subtle "Simulation: off" muted badge or hide entirely? Plan proposes hide when off, amber banner only when on.

---

## Appendix — Verification Checklist (copy into PR description)

- [ ] `uvicorn` boots, Probe #6 logged, `/capabilities` has 16 keys including `simulation.status`
- [ ] `GET /api/v1/simulation` → 200 `{"operation":"simulation.status","result":{"global":bool,"scenarios":[],"raw":...}}` + `no-store`
- [ ] `GET /api/v1/simulation?bad=1` → 400 `invalid_parameters`, no `cscli` spawn
- [ ] Stderr never appears in any response body (only stdout-derived `raw` on success)
- [ ] With `cscli` absent, `GET /simulation` → 200 `unsupported`
- [ ] `npm run typecheck` + `npm run build` green
- [ ] `/overview` shows amber banner when simulation is ON; hidden when OFF; capability badge degrades correctly
- [ ] `/decisions` shows callout when simulation is ON
- [ ] Old routes (`/alerts`, `/decisions`, `/bouncers`, `/machines`, `/allowlists`, `/status/*`, `/capabilities`, `/health`, `/metrics`, `/hub`, static SPA) still green
