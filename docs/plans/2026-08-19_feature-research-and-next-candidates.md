# Plan: Feature Research — Ranked Candidates & Next Proposal

Date: 2026-08-19
Status: Selected — #1 Time-Range & Search + Pagination (user confirmed 2026-08-19) — kanban ready for implementation
Type: Exploratory research (default invocation, no explicit feature requested) → implementation-ready specification for #1
Supersedes: `2026-08-18_feature-research-and-next-candidates.md` (shipped — Simulation Status banner) · `2026-08-17_feature-research-and-inspection-drilldown.md` (shipped — inspect dialogs) · `2026-08-17_feature-research-and-hub-inventory.md` (shipped — Hub Inventory)

## 1. Goal and Non-Goals

### Goal (research phase)
Enumerate the highest-value next features for this single-admin, single-port (8090), read-only CrowdSec Dashboard, rank 5 candidates by user value × implementation cost under lean/native constraints, and detail the top proposal to implementation-ready depth so the user can pick one and proceed without re-planning.

### Goal (recommended feature — Candidate #1)
Add **Time-Range & Search + Pagination for Alerts and Decisions** that extends the existing `alerts.list` / `decisions.list` operations with `since` / `until` (pass-through to `cscli` when supported, server-side `created_at` fallback), substring `scenario_contains`, strict query validation with `invalid_parameters` (no spawn), and `offset`-based pagination over the existing `limit` (1..100) — plus `datetime-local` pickers and Prev/Next pagination in `FiltersBar` / `Alerts.tsx` / `Decisions.tsx`. Single port, no DB, no shell, no new deploy topology.

### Non-Goals (all candidates — and this plan)
- **Mutations** (`decisions delete`, `bouncers/machines/allowlists add/delete`, `hub update/upgrade`, `simulation enable/disable` writes) — read-only invariant holds for #1/#2/#3/#4; #5 is the only candidate that would break it and is ranked last / deferred.
- **Auth/session/RBAC/LDAP/OIDC** — still deferred per `docs/architecture.md` § Out of scope; loopback-bound posture unchanged.
- **Prometheus text exposition** (`GET /metrics` scrape) or Grafana/Prometheus/alerting platform — taste: lean internal tools; CrowdSec's own `/metrics` is scraped directly.
- **Persistence/history/aggregation** — alerts/decisions remain live from `cscli` on every request (plus probe cache for `capabilities`); no DB, no retention.
- **CI/CD, pytest/unit tests, test scaffolding, monitoring dashboards** — explicitly excluded per workflow rules unless user requests them.
- **Docker/K8s, separate databases, new systemd units** — native binary + uvicorn only.
- **Parser/scenario/WAF rule authoring** — out of scope per `crowdsec` skill.

## 2. Current-State Findings

### 2.1 What exists today (inventory)
- **Backend:** FastAPI + Pydantic v2, `backend/main.py:app` (uvicorn `:8090`), `CscliRunner` via `asyncio.create_subprocess_exec` (positional argv, no shell), 17 operation labels in `backend/envelope.py` (16 probed ops + `capabilities.list`), 6 startup probes in `backend/capabilities.py` cached to `app.state.capabilities`, 16 probed ops + `capabilities.list` meta-op. All `GET /api/v1/*` enveloped (`success`/`operation_error` HTTP 200, `request_error` 4xx/5xx, raw `health`), 10 error codes, WARN-logged truncated stderr never returned, `Cache-Control: no-store` on API + SPA fallback. Last route `mount_static` guards `/api/*`.
- **Routers:** `alerts/{list,inspect}`, `decisions/{list,check}`, `machines/{list,inspect}`, `bouncers/{list,inspect}`, `allowlists/{list,inspect,check}`, `status` (`lapi`/`capi`), `capabilities`, `metrics/show` (`GET /metrics` + `GET /metrics/{component}` 14-type allowlist), `hub/list` (`GET /hub`), `simulation/status` (`GET /simulation` text parse) — all read-only `GET`.
- **Frontend:** Vite 6 + React 19 + TS strict + Tailwind v4 + shadcn/ui + React Router 7 + TanStack Query v5 + native `fetch`. 8 routes under `Layout` (`/overview`, `/alerts`, `/decisions`, `/machines`, `/bouncers`, `/allowlists`, `/metrics`, `/hub`) — simulation is banner-only (amber in `Overview.tsx` + `Decisions.tsx`, no standalone route). `DataTable`/`FiltersBar`/`ErrorPanel`/`EmptyState`/`CapabilityBadge`/`LoadingSkeleton`, dialog pattern via `@radix-ui/react-dialog` (`AlertInspectDialog`, `MachineInspectDialog`, `BouncerInspectDialog`, allowlist entries dialog).
- **Completed since last research:** Simulation Status (`simulation.status`, `GET /api/v1/simulation`, Probe #6 text check, `useSimulation` hook, banners in Overview + Decisions) — prior plan #1 gap is now closed. Hub Inventory (`hub.list`, `GET /api/v1/hub`) and Inspect Completion (machine/bouncer dialogs + allowlist entries table) are also shipped.
- **Config/deploy:** Slim YAML `server/cscli/logging` only (`extra="ignore"` for legacy `auth/session`), `cscli.timeout` `^\d+s$` 1..120s, `bind !=0.0.0.0`, `port !=8080`, `DASHBOARD_CONFIG` precedence. Single-port static SPA fallback last (`backend/static.py`), no Docker required.
- **Docs/plans:** `docs/architecture.md` + `docs/operations-reference.md` canonical wire contract; `docs/plans/2026-08-15_fastapi-rebuild.md` + `2026-08-16_metrics-endpoint.md` + `2026-08-17` pair + `2026-08-18` simulation are implemented; no open TODO/FIXME in app code.

### 2.2 Relevant files (read)
`AGENTS.md`, `.commandcode/taste/taste.md`, `docs/architecture.md`, `docs/operations-reference.md`, `docs/plans/2026-08-18_feature-research-and-next-candidates.md`, `docs/plans/2026-08-17_feature-research-and-hub-inventory.md`, `docs/plans/2026-08-17_feature-research-and-inspection-drilldown.md`, `backend/main.py`, `backend/config.py`, `backend/envelope.py`, `backend/errors.py`, `backend/capabilities.py`, `backend/static.py`, `backend/routers/cscli.py`, `backend/routers/alerts/list.py`, `backend/routers/decisions/list.py`, `backend/routers/metrics/show.py`, `backend/routers/hub/list.py`, `backend/routers/simulation/status.py`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/pages/{Overview,Alerts,Decisions,Metrics,Hub}.tsx`, `frontend/src/components/{FiltersBar,DataTable}.tsx`, `frontend/src/hooks/{useAlerts,useDecisions,useSimulation,useMetrics,useHub}.ts`, `frontend/src/lib/api/{client,types,errors}.ts`, `frontend/package.json`, `config.yaml`.

### 2.3 Research summary

#### Existing feature inventory
| Domain | UI | API | Notes |
|---|---|---|---|
| Alerts list + inspect | ✅ table + dialog | `alerts.list`/`inspect` | `limit/scenario/ip` only; exact-match `scenario`/`ip`, no `since/until`, no substring, no offset |
| Decisions list + check | ✅ table | `decisions.list`/`check` | `limit/type/ip` only; no `since/until`, no substring, no offset |
| Machines list + inspect dialog | ✅ table + dialog | `machines.list`/`inspect` | Completed 2026-08-17 drilldown |
| Bouncers list + inspect dialog | ✅ table + dialog | `bouncers.list`/`inspect` | Completed 2026-08-17 drilldown |
| Allowlists list + entries + check | ✅ cards + entries dialog + check | `allowlists.list`/`inspect`/`check` | Completed 2026-08-17 drilldown |
| LAPI/CAPI status | ✅ Overview dots | `status.lapi`/`capi` | boolean only |
| Metrics show (all + 14 filtered) | ✅ tables + `<pre>` fallback | `metrics.show` | live, heterogeneous `Record<string,unknown>` |
| Hub inventory | ✅ per-type tables & badges | `hub.list` | Completed 2026-08-17 hub |
| Simulation status (banner) | ✅ Overview + Decisions banners | `simulation.status` | Completed 2026-08-18; banner-only, no standalone page, no toggle (writes deferred) |
| AppSec inventory | ❌ missing (partial via metrics) | ❌ | `appsec-engine`/`appsec-rule` counters exist but no config/rule list |
| Time-range / pagination / substring search | ❌ missing | ❌ | `GET /alerts` & `GET /decisions` only `limit 25/50/100`; LAPI may hold 10k — biggest volume gap |
| Config/version | ❌ partial (no page) | ❌ | `cscli version` / `config show` not wrapped |
| Explain (paste-a-log) | ❌ missing | ❌ | `cscli explain --log --type` not wrapped |
| Decisions delete (mutation) | ❌ missing | ❌ | read-only invariant; first write would be `decisions delete -i/-r/--id` |

#### Candidate features considered (ranked 5 — value × cost)

| Rank | Candidate | Value | Cost | Rationale |
|---|---|---|---|---|
| **#1 Recommended** | **Time-Range & Search + Pagination (Alerts & Decisions)** — `since`/`until` + substring `scenario_contains` + `offset` | High (volume) | Low-Medium | LAPI may hold 10k alerts/decisions; today only newest `limit 50/100` with exact `scenario`/`ip` is visible. Adding `since`/`until` (cscli pass-through + server-side `created_at` fallback) + substring filter + `offset` pagination unblocks triage on busy hosts with a tiny backend delta (2 routers) and a focused `FiltersBar` extension. Highest daily relief. |
| #2 | **AppSec / WAF Inventory** — `appsec.list` via `cscli appsec-configs/appsec-rules` or `hub` complement | Medium-High | Low-Medium | Surfaces inband vs out-of-band configs, virtual-patching status, per-rule counts — directly relevant for web-facing CrowdSec with AppSec enabled. Taste-safe read-only visibility; reuses `metrics.show`/`hub.list` envelope/probe/router/hook/page shape. |
| #3 | **Version & Config Snapshot** — `config.show` + `cscli version` read-only | Medium | Low | Shows CrowdSec + cscli version, profiles, data-dir drift in one `GET /api/v1/version` + `GET /api/v1/config` (or combined). Trivial argv (`version`, `config show -o json`), no query params, one probe. High trust signal, lowest risk. |
| #4 | **Live Explain — Paste-a-Log Debugger** — `cscli explain --log <line> --type <type>` | Medium | Medium | Paste a log line + type → see which parsers fire / why parsing failed, without SSH. Highest "teach the pipeline" value; needs strict input sanitization (log-line length cap + type allowlist). |
| #5 | **Supervised Decisions Delete (first mutation)** — `decisions.delete` (`-i ip`/`-r range`/`--id`, never `--all`) | High (self-unblock) | Medium-High | Only candidate that breaks read-only invariant. Needs confirmation dialog, audit log, timeout/capability gate, and ideally auth hardening. High value for lockout recovery but bigger risk/scope — defer until read-only gaps closed. |

#### Selection rationale (#1)
- **Lean fit:** read-only, no DB, no auth, single-port, no new deploy artifact — taste requires minimal scope and native deployment; #1 respects all (2 router files extended, no new probe, no new operation label).
- **Broadest relief:** every busy host hits "I see 50 newest but need last 6 hours / that slow-brute scenario" — time-range + substring + offset fixes the #1 volume complaint for both alerts and decisions. No other single slice helps as many triage sessions.
- **Proven pattern:** alert/decision filtering already does server-side `scenario`/`ip` equality + `limit` truncation — extending to `since`/`until`/`scenario_contains`/`offset` is a small, review-bounded delta (same `FiltersBar` + `DataTable` shape, same `success/operation_error` envelope).
- **Cost vs alternatives:** #2 and #3 are smaller but narrower (#3 is audit-only; #2 only for AppSec-enabled hosts). #4 needs input handling and type allowlisting. #5 breaks the read-only promise kept for four releases — deferring it keeps this release safe and shippable. Time-range is the last major read-only gap before considering writes.

#### Rejected / deferred candidates (brief)
- **Parser/scenario authoring & WAF rule editor** — crowdsec skill marks writing rules out of scope; deploy/status only.
- **Notifications CRUD** (Slack/email/webhook) — no `cscli notifications` wrapper, lower frequency, needs persistence.
- **Prometheus/Grafana/metrics history & charts** — taste excludes observability platform; live tables suffice.
- **Console/CAPI enroll detail, `support dump`, `explain --file` bulk** — niche debug tools or heavy zip artifacts, lower daily value.
- **LDAP/OIDC/RBAC, multi-server, Postgres remote/mTLS** — enterprise auth/multi-host is taste-rejected for single-admin internal tool.
- **Bouncers/machines/allowlists CRUD, bulk import/export, CSV export** — mutations or non-trivial persistence; defer after read-only inventory is solid.
- **`hub update` / `hub upgrade --dry-run` proxy** — still write-adjacent; `tainted/missing/update-available` in Hub Inventory already covers the audit need.
- **Simulation dedicated page / toggle** — banner-only was a deliberate taste choice; toggle is a write (`simulation enable/disable`) — defer with #5.

## 3. Proposed Architecture and Data/Control Flow

### 3.1 Top proposal (#1) — Time-Range & Search + Pagination

```
Browser ── GET /api/v1/alerts?limit=&since=&until=&scenario_contains=&offset=  ──► FastAPI /api/v1
                                  ├─ validate query keys against allowlist {limit, scenario, ip, since, until, scenario_contains, offset}
                                  │   └─ unknown or duplicate key → 400 invalid_parameters (no cscli)
                                  ├─ validate limit 1..100, offset >=0, since/until format (ISO-8601 / duration / epoch — see §5.2)
                                  │   └─ invalid → 400 invalid_parameters (no cscli)
                                  ├─ check app.state.capabilities["alerts.list"].supported
                                  │   └─ false → {operation:"alerts.list", error:{code:"unsupported"}} (HTTP 200, no cscli)
                                  ├─ CscliRunner.run(["alerts","list","-m","-l",str(limit_for_cscli),"-o","json", --since?, --until?])
                                  │   where limit_for_cscli = min(100, limit+offset) when offset>0 and cscli lacks native offset (see A1)
                                  │   else ["alerts","list", ...] + ["--since",since] + ["--until",until] if supported; timeout = cfg.cscli_timeout_seconds
                                  ├─ RunResult → classify_failure → operation_error("alerts.list", code) (HTTP 200, stderr WARN-truncated)
                                  ├─ json.loads(stdout); malformed → malformed_output
                                  ├─ normalize: extract_meta + flatten (existing) → alerts[]
                                  ├─ server-side filters (AND):
                                  │   ├─ if since/until were NOT passed to cscli (fallback): filter by created_at >= since && <= until
                                  │   ├─ scenario (existing exact, kept) — stays AND with new scenario_contains
                                  │   ├─ scenario_contains: substring (case-insensitive) on alert.scenario
                                  │   └─ ip (existing exact)
                                  ├─ pagination: alerts = alerts[offset : offset+limit]  (offset defaults 0)
                                  └─ success("alerts.list", alerts) (HTTP 200, Cache-Control: no-store)

Browser ── GET /api/v1/decisions?limit=&type=&ip=&since=&until=&scenario_contains=&offset=  ──► same gate
                                  └─ mirror: check decisions.list, argv ["decisions","list","-l",..., "-o","json", "-t",type?, "-i",ip?, --since?, --until?],
                                     server-side scenario_contains on alert.scenario/dec.scenario, same offset slice, success("decisions.list", decisions)

Startup:  lifespan() unchanged — no new probe (reuses Probe #1 alerts.list).
          If cscli version lacks --since/--until, no probe degradation — the
          router simply falls back to server-side created_at filtering (no 500).
```

**Why this shape:**
- **No new operation label** — reuses `alerts.list` + `decisions.list` (same as hub vs metrics precedent where new resource got a new label, but filtered views stay on the same label). `capabilities` still 16 probed ops.
- **`since`/`until` pass-through when available** lets LAPI filter server-side (more efficient for 10k rows); fallback to Python `created_at` filter keeps the feature working on older CrowdSec.
- **`scenario_contains` stays server-side** — never enters argv, so injection surface is just length/content validation; keeps `CscliRunner` argv allowlist tight and shareable with existing code.
- **`offset` as server-side slice** avoids new cscli flags; works even if cscli has no `--offset`. If a future cscli adds native offset/limit, switch to passthrough with no API contract change (offset/limit remain query params).
- **Strict query rejection** (unknown/duplicate → 400 without spawn) matches the `metrics`/`hub`/`simulation` boundary and closes the current gap where alerts/decisions silently ignore unknown keys.

### 3.2 Architecture notes for other candidates (not detailed unless selected)
- **#2 AppSec inventory:** `GET /api/v1/appsec` → `["appsec-configs","list","-o","json"]` + `["appsec-rules","list","-o","json"]` fan-out (or single `hub.list` extension if configs already inside hub payload); `AppSec.tsx` page with inband/out-of-band sections + per-rule counts.
- **#3 Version & config:** `GET /api/v1/version` → `["version"]` (text) + probe; `GET /api/v1/config` → `["config","show","-o","json"]`; `Version.tsx` or Overview card; no query params.
- **#4 Explain:** `POST /api/v1/explain` or `GET /api/v1/explain?log=&type=` → `["explain","--log",log,"--type",type,"--only-successful-parsers"]` with strict log-line length cap (4KB) and type allowlist (syslog, nginx, apache2, json…); response is parsed parser-hit list; needs `invalid_parameters` on overlong/unknown type.
- **#5 Decisions delete:** first `POST`/`DELETE` mutation: `DELETE /api/v1/decisions/{id}` + `DELETE /api/v1/decisions?ip=&range=` with allowlisted `cscli decisions delete -i/-r/--id` (never `--all`), `ConfirmDialog`, audit log, and ideally auth gate — biggest contract change.

## 4. Exact Files / Directories to Create and Modify

### 4.1 Top proposal (#1) — Time-Range & Search + Pagination

**Backend — modified**
- `backend/routers/alerts/list.py` — extend `list_alerts` signature: `since: str | None = Query(None)`, `until: str | None = Query(None)`, `scenario_contains: str | None = Query(None)`, `offset: int = Query(0, ge=0, le=10000)`; add `Request` query-allowlist check (`set(request.query_params.keys()) ⊆ {limit,scenario,ip,since,until,scenario_contains,offset}` plus duplicate-key check via `request.query_params.get_list` or raw `scope["query_string"]` parse); add `since`/`until` format validation (see §5.2) → 400 `invalid_parameters` without spawn; capability gate (`alerts.list` `unsupported`); build argv — when `since`/`until` are supported and valid, append `["--since", since, "--until", until]`-style flags (exact flag names from `A1` validation; fallback: omit from argv and filter server-side); `CscliRunner.run(argv, timeout=runner.default_timeout)`; `classify_failure` + `operation_error(ALERTS_LIST, code)`; `json.loads` + `malformed_output` on bad JSON; reuse `extract_meta` + flatten; add `scenario_contains` substring filter (case-insensitive) + `since`/`until` fallback filter on `created_at` (ISO-8601 parse with `datetime.fromisoformat` coercion); `offset` slice `alerts[offset:offset+limit]`; return `success(ALERTS_LIST, alerts)` with `Cache-Control: no-store`.
- `backend/routers/decisions/list.py` — mirror: `since`, `until`, `scenario_contains`, `offset` added; query-allowlist `{limit,type,ip,since,until,scenario_contains,offset}` (`type` is alias for `decision_type`); same validation + gate (`decisions.list`); argv `["decisions","list","-l",str(limit_for_cscli),"-o","json"]` plus `["-t",type]`/`["-i",ip]` when present plus `["--since",since]`/`["--until",until]` when supported; same `classify_failure`/`operation_error`/`malformed_output`; flatten decisions; same `scenario_contains` + `since`/`until` fallback + `offset` slice; `success(DECISIONS_LIST, decisions)` with `Cache-Control: no-store`.
- `backend/envelope.py` — no new label (reuses `ALERTS_LIST`/`DECISIONS_LIST`); optionally add comment that `alerts.list`/`decisions.list` now support `since/until/scenario_contains/offset` query extensions.
- `backend/capabilities.py` — no change (reuses Probe #1 `alerts.list`); no new probe.
- `backend/main.py` — no wiring change (routers already mounted).
- `docs/architecture.md` — update `alerts.list` + `decisions.list` rows to include `since`/`until`/`scenario_contains`/`offset` query params, note pass-through vs server-side fallback, keep envelope/probe table accurate (still 6 probes, 16 probed ops).
- `docs/operations-reference.md` — extend `GET /alerts` + `GET /decisions` rows with new params and validation rows (unknown/duplicate → 400, bad `since`/`until` format → 400, `scenario_contains` length cap, `offset` bounds), note `cscli` argv mapping and that query rejection happens before spawn.
- `backend/config.py` / `config.yaml` — no change.

**Frontend — new**
- (none required — extensions are in-place).

**Frontend — modified**
- `frontend/src/hooks/useAlerts.ts` — extend `useAlerts(opts: {limit?, scenario?, ip?, since?, until?, scenario_contains?, offset?})` → `apiGet<Alert[]>('/alerts', opts)` passthrough; update `Alert` type if needed (no schema change).
- `frontend/src/hooks/useDecisions.ts` — extend `useDecisions(opts: {limit?, type?, ip?, since?, until?, scenario_contains?, offset?})` similarly.
- `frontend/src/components/FiltersBar.tsx` — add `since`/`until` inputs (`type="datetime-local"` with `YYYY-MM-DDThh:mm` → ISO-8601 conversion on change), `scenario_contains` text input, and pagination slot (`children` already supports it — wire Prev/Next + `Page N` + `Showing X–Y` inside `Alerts.tsx`/`Decisions.tsx` rather than inside `FiltersBar` to keep the bar generic; alternatively extend `FiltersBar` with an `append` slot).
- `frontend/src/pages/Alerts.tsx` — add state `since: string`, `until: string`, `scenarioContains: string`, `offset: number`; wire to `useAlerts` (reset `offset` to 0 when any filter changes); add `since`/`until` pickers + `scenario_contains` field in `FiltersBar`; add pagination bar (Prev/Next buttons, `limit` already in `FiltersBar`, `offset` label); keep `scenario` exact + `ip` exact filters alongside new `scenario_contains` substring; `onClear` resets all 5 filters + `offset`.
- `frontend/src/pages/Decisions.tsx` — mirror: add `since`/`until`/`scenario_contains`/`offset` state, wire to `useDecisions`, same picker + pagination UI, keep `type` + `ip` alongside `scenario_contains`.
- `frontend/src/lib/api/types.ts` — no new constants (reuses existing `ALERTS_LIST`/`DECISIONS_LIST` strings via hooks); optionally export `AlertsListParams`/`DecisionsListParams` types for param validation reuse.
- `frontend/src/lib/api/client.ts` — no change (`apiGet` already serializes `params` via `URLSearchParams`); pagination is just another param.

**Docs/deploy — modified (minimal)**
- `deploy/config.example.yaml` — no new key; optionally comment that time-range uses `cscli.timeout`.
- `frontend/package.json` — no new dependency (native `datetime-local` inputs, no date-picker library).

**Explicitly not created**
- `backend/tests/`, new DB, Prometheus exporters, Grafana dashboards, `docs/command-matrix.md` (still dropped), auth/session files, new systemd unit, `backend/routers/{alerts,decisions}/search.py` (no new router file — extensions live in the existing `list.py` files).

### 4.2 Other candidates (if selected after this plan — sketch)
- **#2 AppSec:** `backend/routers/appsec/{list,status}.py` or extend `hub/list.py` (decision at implementation — see §5.2), `frontend/src/hooks/useAppSec.ts` + `frontend/src/pages/AppSec.tsx`, layout tab or nav entry, `docs/architecture.md` + `operations-reference.md` rows for `GET /api/v1/appsec`.
- **#3 Version:** `backend/routers/version.py` / `backend/routers/config/show.py` (or single `version.py`), `frontend/src/hooks/useVersion.ts`, optional `frontend/src/pages/Version.tsx` or Overview card + docs.
- **#4 Explain:** `backend/routers/explain.py` (allowlisted type set + log length cap), `frontend/src/pages/Explain.tsx` with textarea + type selector.
- **#5 Decisions delete:** `backend/routers/decisions/delete.py` (new mutation), `frontend/src/hooks/useDeleteDecision.ts` (`useMutation`), `ConfirmDialog` — plus `backend/errors.py` consideration and auth discussion.

## 5. Interfaces, Schemas, Routes, Commands, Configuration Contracts

### 5.1 HTTP interface (extends `docs/architecture.md` + `docs/operations-reference.md`)

All responses: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` (API + SPA fallback rule unchanged).

| Method | Path | Operation | Params | Success `result` shape | Notes |
|--------|------|-----------|--------|------------------------|-------|
| GET | `/api/v1/alerts` | `alerts.list` | `limit:int` 1..100 (default 50) · `scenario:string` exact · `ip:string` exact · **`since:string`** (ISO-8601 / duration — see §5.2, optional) · **`until:string`** (same, optional) · **`scenario_contains:string`** 1..64 chars substring, case-insensitive (optional) · **`offset:int` 0..10000** (default 0) — any unknown key or duplicate key → 400 `invalid_parameters` without spawn | `Alert[]` (flattened alerts, same shape as today; name `scenario`, `source_ip`, `created_at`, etc.) — filtered AND (`scenario` exact ∩ `ip` ∩ `scenario_contains` ∩ `since/until` ∩ pagination) then `offset`-sliced | Extended; backward compatible — old `?limit&scenario&ip` still works |
| GET | `/api/v1/decisions` | `decisions.list` | `limit:int` 1..100 (default 50) · `type:string` (alias `type`) · `ip:string` · **`since:string`** · **`until:string`** · **`scenario_contains:string`** · **`offset:int`** — same unknown/duplicate → 400 | `Decision[]` (flattened decisions, same shape; `scenario`, `source_ip`, `created_at`, `type`, `scope`…) — same AND + slice | Extended; `type` and `ip` keep working |
| GET | `/api/v1/alerts/inspect/{id}` | `alerts.inspect` | path `alert_id:int` | unchanged | unchanged |
| GET | `/api/v1/decisions/check/{ip}` | `decisions.check` | path `ip` | unchanged | unchanged |
| GET | `/api/v1/capabilities` | `capabilities.list` | — | Now still 16 entries (no new probed op) | Probe cache unchanged |

**Validation rules (new / tightened):**
- Unknown query key on `/alerts` or `/decisions` → `400 {error:{code:"invalid_parameters"}}` **without spawning `cscli`**. Allowlist is the row above per route.
- Duplicate query key (e.g. `?limit=50&limit=100` or `?since=...&since=...`) → 400 without spawn. Detect via raw `scope["query_string"]` or `request.query_params.get_list(key)` length >1.
- `limit` not in 1..100 or not int → 400 (existing FastAPI `ge/le` already does this; keep).
- `offset` not int or <0 or >10000 → 400.
- `scenario_contains` length 0 (empty) is treated as absent (cleared filter); 1..64 chars, no control chars (reject `\r\n\0`), valid UTF-8 — over 64 or with controls → 400.
- `scenario` and `ip` and `type` keep their current validation; `scenario` + `scenario_contains` may both be present (AND).
- `since`/`until` format validation per §5.2 — invalid format → 400 without spawn; `since` after `until` → 400.

**Envelope examples:**

Success — alerts filtered by last 6h + substring (HTTP 200):
```json
{ "operation": "alerts.list", "result": [
  {"id": 42, "scenario": "crowdsecurity/ssh-bf", "source_ip": "1.2.3.4", "created_at": "2026-08-19T08:12:00Z", "country": "US", "as_name": "Example ASN"}
]}
```

Success — decisions paginated (HTTP 200):
```json
{ "operation": "decisions.list", "result": [
  {"id": 7, "scenario": "crowdsecurity/http-bf", "source_ip": "5.6.7.8", "type": "ban", "scope": "Ip", "duration": "4h"}
]}
```

Request-level failures (HTTP 400 — no cscli):
```json
{ "error": { "code": "invalid_parameters", "message": "The request parameters are invalid." } }
```
Triggered by: `?unknown=1`, `?since=not-a-date`, `?scenario_contains=` + 200-char string, `?offset=-1`, `?since=2026-08-20&until=2026-08-19` (since after until), duplicate `?limit=50&limit=100`.

Operation-level failures (HTTP 200):
```json
{ "operation": "alerts.list", "error": { "code": "unsupported", "message": "This operation is not supported." } }
{ "operation": "alerts.list", "error": { "code": "timeout", "message": "The CrowdSec command timed out." } }
{ "operation": "decisions.list", "error": { "code": "crowdsec_failure", "message": "The CrowdSec command failed." } }
{ "operation": "alerts.list", "error": { "code": "malformed_output", "message": "CrowdSec returned malformed output." } }
```

### 5.2 `since` / `until` contract — what to validate on host (A1)

**cscli surface to probe on host before T1** (decision to validate):
```bash
cscli alerts list --help | cat
cscli decisions list --help | cat
# Check for --since / --until / --from / --to flags, their value format,
# and whether they accept: ISO-8601 (2026-08-19T00:00:00Z), relative durations (6h, 1d), epoch.
```

**Observed CrowdSec 1.5–1.6.x:** `cscli alerts list` supports `--since` (duration or RFC3339) and sometimes `--until`/`--to`. **Implementation handles both cases defensively:**
- **If cscli supports `--since`/`--until`:** backend appends `["--since", since]` / `["--until", until]` to argv with strict format validation:
  - Accept: RFC3339 / ISO-8601 `YYYY-MM-DD` or `YYYY-MM-DDThh:mm[:ss][Z]` (with or without `Z`, with or without fractional seconds), or Go duration `^[0-9]+[smhd]$` (e.g. `6h`, `30m`, `7d` with `d`→`h` coercion if needed), max 32 chars, no shell metachars, no `--` prefix inside value.
  - Parse check: try `datetime.fromisoformat(value.replace("Z","+00:00"))` or `re.fullmatch(r"[0-9]+[smhd]", value)` — fail → 400.
  - Length cap 32 prevents argv bloat.
- **If cscli lacks `--since`/`--until`:** omit from argv; apply **server-side fallback filter** by parsing each alert/decision `created_at` (ISO-8601, `datetime.fromisoformat` with `Z`→`+00:00` coercion) and keeping only `since ≤ created_at ≤ until`. Malformed `created_at` rows are kept (not filtered out) to avoid dropping data on clock skew.
- **`since` after `until`:** 400 regardless of mode.

Validation decision: if host probes show `cscli alerts list` supports `--since` but not `--until`, pass `since` through and apply `until` server-side — mixed mode is allowed.

### 5.3 `cscli` command contract (backend → subprocess)

| Endpoint | argv (after executable) when filters absent | argv when filters present (pass-through mode) | Timeout | Stdout handling |
|----------|---------------------------------------------|-----------------------------------------------|---------|-----------------|
| `GET /alerts` (no time-range) | `["alerts","list","-m","-l",str(limit_for_cscli),"-o","json"]` | same + `["--since",since]` + `["--until",until]` when A1-proven and valid | `cfg.cscli_timeout_seconds` (default 30s) | `json.loads(stdout)` → `Alert[]`; empty `""` → `[]`; malformed → `malformed_output` |
| `GET /decisions` (no time-range) | `["decisions","list","-l",str(limit_for_cscli),"-o","json"]` + `["-t",type]`/`["-i",ip]` when present | same + `["--since",since]` + `["--until",until]` when A1-proven and valid | same | same |
| Probe #1 (startup) | `["alerts","list","-o","json","-l","1"]` 5s | n/a | 5.0s | validates structured reads |

`limit_for_cscli` sizing: when `offset==0`, `limit_for_cscli = limit` (no overfetch). When `offset>0` and cscli has no native offset, `limit_for_cscli = min(100, limit+offset)` then Python slice `alerts[offset:offset+limit]` — caps cscli fetch at 100 rows per request (same max `limit`) to bound argv/time. If future cscli gains `--offset`, switch to native offset with no API change.

No shell, positional argv only. **Never** pass `scenario_contains` into argv — server-side only.

### 5.4 Configuration

No new YAML key. Reuses:
```yaml
cscli:
  executable_path: /usr/bin/cscli   # existing; fallbacks unchanged
  timeout: 30s                      # governs alerts/decisions handlers and Probe #1
```
Legacy `auth`/`session` blocks remain `extra="ignore"`.

### 5.5 Internal types

Backend (in `backend/routers/alerts/list.py` / `decisions/list.py`):
```python
# No new envelope label.
ALLOWED_ALERTS_KEYS = {"limit","scenario","ip","since","until","scenario_contains","offset"}
ALLOWED_DECISIONS_KEYS = {"limit","type","ip","since","until","scenario_contains","offset"}
SINCE_UNTIL_RE = re.compile(r"^([0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}(:[0-9]{2})?Z?)?|[0-9]+[smhd])$")
SCENARIO_CONTAINS_MAX = 64

def _parse_since_until(value: str) -> datetime | timedelta: ...
def _validate_since_until(since: str | None, until: str | None) -> None:  # raises ValueError → 400
    ...

def _matches_scenario_contains(alert_scenario: str | None, needle: str | None) -> bool:
    return needle is None or needle.lower() in (alert_scenario or "").lower()
```

Frontend:
```ts
// frontend/src/hooks/useAlerts.ts
export type AlertsParams = { limit?: number; scenario?: string; ip?: string; since?: string; until?: string; scenario_contains?: string; offset?: number };
export function useAlerts(opts: AlertsParams): UseQueryResult<Alert[]>;

// frontend/src/hooks/useDecisions.ts
export type DecisionsParams = { limit?: number; type?: string; ip?: string; since?: string; until?: string; scenario_contains?: string; offset?: number };
export function useDecisions(opts: DecisionsParams): UseQueryResult<Decision[]>;

// frontend/src/components/FiltersBar.tsx
// No new prop contract — since/until/scenario_contains live in page state;
// FiltersBar keeps its existing {key,label,value,onChange,placeholder}[] shape.
// Pages pass 3 filters + 2 datetime-local inputs + pagination slot.
```

## 6. Ordered Implementation Tasks (with Dependencies and Parallelization)

### Top proposal (#1) — Time-Range & Search + Pagination (shippable in one pass)

| # | Task | Files | Depends on | Parallelizable with |
|---|------|-------|------------|---------------------|
| T1 | **Backend — alerts time-range + search + pagination** — extend `backend/routers/alerts/list.py` with `since`/`until`/`scenario_contains`/`offset`, query-allowlist + duplicate-key check, `since`/`until` format validation (32-char cap, ISO-8601/duration regex, `since`≤`until`), capability gate before spawn, argv `["alerts","list","-m","-l",limit_for_cscli,"-o","json"]` + `["--since",since]`/`["--until",until]` when A1-proven else server-side `created_at` fallback, `classify_failure` → `operation_error(ALERTS_LIST, code)`, `json.loads` + `malformed_output`, `extract_meta` + flatten (reuse), `scenario_contains` case-insensitive substring + `since`/`until` fallback filters + `offset` slice, `success(ALERTS_LIST, alerts)` with `Cache-Control: no-store`. | `backend/routers/alerts/list.py` | — (A1 validated) | T2 |
| T2 | **Backend — decisions time-range + search + pagination** — mirror T1 in `backend/routers/decisions/list.py` for `decisions.list`: allowlist `{limit,type,ip,since,until,scenario_contains,offset}`, same validation + gate + argv (`-t`/`-i` preserved) + filters (`scenario_contains` on `decisions[0].scenario` or `alert.scenario`) + offset slice + `success(DECISIONS_LIST, …)` no-store. | `backend/routers/decisions/list.py` | — | T1 |
| T3 | **Frontend hooks** — extend `frontend/src/hooks/useAlerts.ts` (`AlertsParams` + `since/until/scenario_contains/offset`) and `frontend/src/hooks/useDecisions.ts` (`DecisionsParams`) to pass new params via `apiGet`. | `frontend/src/hooks/useAlerts.ts`, `frontend/src/hooks/useDecisions.ts` | — | T1/T2 (no file overlap) |
| T4 | **Frontend pages — filters + pagination** — `frontend/src/pages/Alerts.tsx`: add `since`/`until` (`datetime-local` → ISO-8601 `YYYY-MM-DDThh:mm:00Z` on query), `scenarioContains`, `offset` state; wire to `useAlerts` (reset `offset`→0 on filter change); add `since`/`until` pickers + `Scenario contains` input into `FiltersBar`; add pagination bar (Prev/Next, `Showing offset+1–offset+data.length`, disabled at bounds, `offset` step = `limit`). Mirror in `frontend/src/pages/Decisions.tsx`. Extend `frontend/src/components/FiltersBar.tsx` only if a generic slot is cleaner (keep `children` slot for pagination to avoid bar bloat). | `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/Decisions.tsx`, `frontend/src/components/FiltersBar.tsx` | T3 | — (after T3) |
| T5 | **Docs** — update `docs/architecture.md` (alerts/decisions `since/until/scenario_contains/offset` rows, "pass-through vs fallback" note, envelope/probe table stays 6/16) and `docs/operations-reference.md` (extend `GET /alerts` + `GET /decisions` tables with new params + validation section + cscli argv mapping + envelope examples). | `docs/architecture.md`, `docs/operations-reference.md` | T1 + T2 + T4 | — |

**Critical path:** (T1 ∥ T2 ∥ T3) → T4 → T5. Backend T1/T2 are independent (no file overlap), T3 is independent frontend (no overlap with T1/T2), T4 gates on T3, T5 gates on T1/T2/T4. Single agent does T1→T5 sequentially (2 backend files + 2 hook files + 2 pages + 1 component + 2 docs).

**Kanban:** `docs/kanban/2026-08-19_time-range-filtering/` with `task-01.md`…`task-05.md` if team wants cards; otherwise implement directly from this plan.

### Other candidates (estimates if selected instead / next)

| Candidate | Tasks (sketch) | Effort |
|---|---|---|
| #2 AppSec inventory | probe + router fan-out (`appsec-configs`/`appsec-rules` list or hub extension) + hook + `AppSec.tsx` page + nav/docs | ~0.5–1d |
| #3 Version & config | `version` + `config show` routes (or single), hook(s), `Version.tsx` or Overview card + docs | ~0.5d |
| #4 Explain | allowlisted type set + log-length cap (4KB) + `explain` router (text parse) + `Explain.tsx` textarea page + docs | ~0.5–1d |
| #5 Decisions delete | envelope+capability + mutation router with allowlisted `-i/-r/--id` (never `--all`), `classify_failure` reuse, `ConfirmDialog` + `useMutation`, audit, docs; needs auth discussion | ~1–2d |

## 7. Acceptance Criteria and Verification

### Backend — manual (from `backend/`, no pytest per lean scope)

```bash
# 0. Validate cscli flag support before T1 (A1)
cscli alerts list --help | cat
cscli decisions list --help | cat
# Note: --since/--until flags + format (ISO-8601 vs duration)

# 1. Boots, Probe #1 still green, no stderr leak
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
# logs: Probe #1 line visible; no stack trace

# 2. Health unchanged
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}

# 3. Capabilities still 16 ops (no new probed op)
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d['result'])==16; print('ok 16')"

# 4. Alerts — backward compat (no new params)
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50" | python3 -m json.tool | head -n 20
# → {"operation":"alerts.list","result":[...]}
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?limit=50" | grep -i cache-control
# → cache-control: no-store

# 5. Alerts — since/until (pass-through or server-side fallback)
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&since=2026-08-19T00:00:00Z&until=2026-08-19T23:59:59Z" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['operation']=='alerts.list'; print('since/until ok', len(d['result']))"
# also duration form if supported:
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&since=6h" | python3 -c "import sys,json; json.load(sys.stdin); print('duration ok')"

# 6. Alerts — scenario_contains substring (case-insensitive)
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&scenario_contains=ssh" | python3 -c "import sys,json; d=json.load(sys.stdin); assert all('ssh' in (a.get('scenario') or '').lower() for a in d['result']); print('contains ok', len(d['result']))"

# 7. Alerts — offset pagination (slice)
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=25&offset=25" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['operation']=='alerts.list'; print('offset ok', len(d['result']))"
# Combining filters AND pagination:
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=25&scenario_contains=http&since=2026-08-18T00:00:00Z&offset=0" | python3 -m json.tool | head -n 20

# 8. Decisions — mirror
curl -s "http://127.0.0.1:8090/api/v1/decisions?limit=50&scenario_contains=ssh&offset=0" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['operation']=='decisions.list'; print('decisions contains ok')"

# 9. Query rejection — unknown key (no cscli spawn)
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&unknown=1"
# → HTTP/1.1 400 + {"error":{"code":"invalid_parameters", ...}}
curl -i -s "http://127.0.0.1:8090/api/v1/decisions?limit=50&bad=1"
# → 400

# 10. Query rejection — duplicate key
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&limit=100"
# → 400
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?since=2026-08-19T00:00:00Z&since=2026-08-19T01:00:00Z"
# → 400

# 11. Query rejection — bad since/until format / since after until / overlong scenario_contains / bad offset
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?since=not-a-date"  # → 400
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?since=2026-08-20T00:00:00Z&until=2026-08-19T00:00:00Z"  # → 400
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?scenario_contains=$(python3 -c "print('x'*65)")"  # → 400
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?offset=-1"  # → 400
curl -i -s "http://127.0.0.1:8090/api/v1/alerts?offset=99999"  # → 400 (>10000)

# 12. Operation-level failures still enveloped (degraded: stop crowdsec or break executable_path)
curl -s http://127.0.0.1:8090/api/v1/alerts?limit=50 | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['error']['code'] in ('unavailable','unsupported','timeout','crowdsec_failure','malformed_output')"

# 13. Stderr never returned
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50" 2>&1 | grep -q "crowdsec" && echo "check not to leak raw stderr strings" || echo "ok no leak spot check"

# 14. Static still last — SPA fallback not shadowing /api
curl -s http://127.0.0.1:8090/api/v1/alerts?limit=50 | python3 -c "import json,sys; json.load(sys.stdin); print('json ok')"
curl -i -s http://127.0.0.1:8090/unknown-route | head -n 1  # → 200 text/html (SPA fallback)
```

### Frontend — manual (from `frontend/`)

```bash
npm install
npm run typecheck  # → green (no drift between hooks and pages)
npm run build      # → green; dist/index.html + dist/assets/*.js exist

# Dev proxy walk
npm run dev  # vite dev against running uvicorn (proxy /api → 127.0.0.1:8090)
# Visit:
#   /alerts — still lists newest 50; exact scenario + IP filters still work
#   /alerts — set Since=2026-08-19T00:00 + Until=2026-08-19T23:59 → table narrows to that window
#   /alerts — type "ssh" in Scenario contains → only crowdsecurity/ssh-bf etc. remain (case-insensitive)
#   /alerts — combine: since=6h + scenario_contains=http + limit 25 → filtered AND paginated
#   /alerts — pagination: Next → offset 25 → new slice; Prev → offset 0; changing any filter resets to page 1; Clear filters resets all + offset
#   /decisions — mirror: since/until + scenario_contains + pagination all work; type + IP still work alongside
#   with cscli missing, CapabilityBadge shows "unsupported" and lists show ErrorPanel with retry
#   no console errors, no leaked stderr strings beyond result rows
```

### Static E2E (with `uv` + built `frontend/dist`)

```bash
curl -i http://127.0.0.1:8090/                     # → 200 text/html no-store
curl -i http://127.0.0.1:8090/assets/*.js         # → 200 immutable
curl -i http://127.0.0.1:8090/unknown-route       # → 200 index.html (SPA fallback)
curl -s "http://127.0.0.1:8090/api/v1/alerts?limit=50&scenario_contains=ssh" | python3 -m json.tool  # still works when dist exists
```

### Docs

```bash
grep -n "scenario_contains" docs/architecture.md docs/operations-reference.md
grep -n "since.*until" docs/operations-reference.md
grep -n "offset" docs/operations-reference.md
grep -n "GET.*/alerts" docs/operations-reference.md
grep -n "GET.*/decisions" docs/operations-reference.md
grep -rn "/api/v1/alerts" docs/ 2>&1 | head
```

## 8. Security, Compatibility, Migration, Operational Considerations

### Security
- **No shell** — `CscliRunner` uses `asyncio.create_subprocess_exec(*cmd)` with positional argv; only `since`/`until` would ever enter argv and only after strict allowlist validation (32-char cap, ISO-8601/duration regex, no `--`/shell metachars). `scenario_contains`/`offset` never enter argv.
- **Query rejection is the boundary** — unknown/duplicate keys and bad `since`/`until`/`scenario_contains`/`offset` are 400 **without spawning**. Same precedent as `metrics`/`hub`/`simulation` (now tightened for alerts/decisions too).
- **No stderr in responses** — `result.stderr` WARN-logged truncated ~500 chars, never placed in JSON (`classify_failure` + `SAFE_MESSAGES` only). JSON body on success is always `cscli` stdout-derived alert/decision rows, filtered then sliced; no raw stderr echo.
- **DoS hygiene** — `cscli` fetch bounded at 100 rows per request (`limit_for_cscli≤100`); server-side filter + slice is O(n≤100) — trivial; `cscli.timeout` applies; `scenario_contains` capped 64 chars; `offset` capped 10000; `since`/`until` capped 32 chars.
- **No auth change** — endpoints inherit loopback-bound, no-session posture; if reverse-proxied, keep behind same mTLS/basic-auth as other `/api/v1/*`.
- **Static precedence** — `/api/v1/alerts` and `/api/v1/decisions` on `api` router before `mount_static`; `/api/*` never falls through.

### Compatibility
- **Additive only** — 4 new optional query params + strict unknown/duplicate rejection. Existing `GET /alerts?limit&scenario&ip` and `GET /decisions?limit&type&ip` keep working byte-for-byte. New clients may send `since/until/scenario_contains/offset`; old clients omit them.
- **Strict query rejection is a tighten** — today unknown keys are silently ignored; after this, they are 400. This is intentional (matches other routes) but is a contract tighten — callers sending stray keys will get 400 instead of 200. Docs will call it out; no known internal caller does this (frontend only sends allowlisted keys).
- **Frontend** — `Alerts.tsx`/`Decisions.tsx` extensions are additive; `useAlerts`/`useDecisions` param widening is backward compatible (new fields optional). `apiGet` unchanged; `FiltersBar` widening is backward compatible (new inputs only).
- **Config** — fully backward compatible; no new required YAML key; probes unchanged.
- **CrowdSec version skew** — older builds lacking `--since`/`--until` get server-side `created_at` fallback — same UX shape, no 500; newer builds get efficient LAPI-side filtering.

### Migration
- No data migration. No DB. Restart `uvicorn` — no probe change. If `cscli` absent, `alerts.list`/`decisions.list` remain `unsupported` until binary appears and service restarts (same as today).
- Frontend cache: TanStack Query keys include new `since/until/scenario_contains/offset` fields — cache partitions automatically; no manual invalidation needed.

### Operational
- **Deployment** — single `uvicorn` process, one port (8090), same PM2/`ecosystem.config.cjs` unit; no new unit.
- **Observability** — WARN logs on `crowdsec_failure/timeout/malformed_output` + `invalid_parameters` at request-validation time; no new log format.
- **Capacity** — per-request cost is one `cscli alerts/decisions list` (≤100 rows) plus O(100) Python filter/slice — negligible vs `hub`/`metrics` JSON parsing.
- **Failure modes** — LAPI down / cscli missing / permission denied / timeout → operation-level envelope with retryable (`timeout`, `unavailable`) vs non-retryable (`permission_denied`, `malformed_output`, `unsupported`); frontend `ErrorPanel` Retry re-issues `GET` with same params; query-level 400s are not retryable without fixing params.

## 9. Risks, Unresolved Assumptions, and Reviewer Ownership

### Risks
| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | **`cscli alerts/decisions list --since/--until` flags don't exist or use different names (`--from/--to`) on target host CrowdSec version** | Medium | Low | Validate A1 on host before T1; if flags differ, map to actual names or fall back to server-side `created_at` filter with no argv pass-through — no API contract change. |
| R2 | **`since`/`until` format accepted by cscli differs from frontend `datetime-local` conversion** (cscli may want `2026-08-19 00:00:00` not ISO-8601, or relative `6h`) | Medium | Low | Accept both ISO-8601 and `N[smhd]` in validation; convert `datetime-local` to `YYYY-MM-DDThh:mm:00Z` (ISO-8601); if `cscli` rejects with `crowdsec_failure`, fallback note in `operations-reference.md` + server-side fallback. |
| R3 | **`created_at` fallback reliability** — some alerts have missing/malformed `created_at`, or timezone-naive vs `Z` | Low | Low | Treat missing/malformed `created_at` as "keep" (don't filter out) to avoid dropping rows; parse with `fromisoformat(Z→+00:00)` and naive→UTC coercion. |
| R4 | **Strict unknown-key rejection breaks a caller that today sends stray keys** (contract tighten) | Low | Low | Documented tighten in `operations-reference.md` and `architecture.md`; no known internal caller; can temporarily relax by allowlisting if a specific integration breaks. |
| R5 | **`limit_for_cscli = limit+offset` overfetch truncates when true total >100 and offset is large** (e.g. offset 75, limit 50 → fetch 100, slice 75:125 → only 25 rows because total was 200 but we only fetched 100) | Medium | Low | Document that pagination is over newest 100 when cscli lacks native offset; for deeper history use `since`/`until` to window first then paginate within 100. If native `--offset` exists, use it and remove the 100 cap. |
| R6 | **`scenario_contains` may match too broadly** (e.g. `http` matches `http-bf`, `http-crawl`, `http-probing`) | Low | Low | Intentional — substring is broader than exact `scenario`; keep both (`scenario` exact + `scenario_contains` substring) as AND so power users keep exact and newcomers get substring. |

### Assumptions (explicit — confirm before T1)
| # | Assumption | If wrong, plan changes |
|---|------------|------------------------|
| A1 | `cscli alerts list` / `cscli decisions list` support for `--since`/`--until` flags and accepted value format — **must validate on host** via `cscli alerts list --help` / `cscli decisions list --help` before implementing pass-through. | If flags absent or named differently, replace `--since`/`--until` in §5.3 with actual names or drop argv pass-through entirely and rely on server-side `created_at` fallback — no wire contract change (query params stay `since`/`until`). |
| A2 | No new config key wanted; `cscli.timeout` (30s) is acceptable for alerts/decisions (observed <1s for `limit 100`). | If dedicated timeout needed, add `alerts.timeout` — excluded now per lean scope. |
| A3 | `offset` as server-side slice over ≤100 rows is acceptable; native `cscli --offset` is not assumed. | If reviewer prefers not to overfetch, keep `limit_for_cscli = limit` and slice only `offset < limit` (simpler but next page may repeat); plan proposes `limit+offset` capped at 100 to allow `offset 25/50/75` without native flag. |
| A4 | Frontend `datetime-local` (no date-picker library) is sufficient for `since`/`until`; value converted to ISO-8601 `YYYY-MM-DDThh:mm:00Z` before query. | If reviewer wants a richer picker, add a tiny native calendar later — no new dependency now per lean scope. |
| A5 | `scenario_contains` 64-char cap + no-control-chars is sufficient; no per-scenario allowlist needed (search is free-text substring). | If allowlist preferred, add `cscli hub list`-derived scenario names as hints only (not validation gate). |
| A6 | Kanban still date-prefixed `docs/kanban/YYYY-MM-DD_<plan>/` — next board `docs/kanban/2026-08-19_time-range-filtering/` if wanted. | If kanban not wanted, implement directly from this plan. |

### Reviewer ownership
- **Primary reviewer:** `crowdsec-documentation-reviewer` (wire contract + envelope invariants + docs coherence — `since`/`until`/`scenario_contains`/`offset` in both docs, strict 400 boundary parity with `metrics`/`hub`/`simulation`).
- **Secondary reviewer:** `crowdsec-command-mapper` (probe correctness, argv allowlist — only `since`/`until` enter argv after strict regex, `scenario_contains`/`offset` never do, no-shell invariant).

## 10. Alternatives Considered

| Alt | Description | Why not chosen |
|-----|-------------|----------------|
| Native `cscli --offset` pagination only (no server-side slice) | Would require `cscli` ≥X to paginate at all | Not portable to older CrowdSec; server-side slice over 100 rows works everywhere and is cheap. Native offset can be adopted later with no API change. |
| Separate `GET /api/v1/alerts/search` resource | New route + new operation label + extra probe | Overkill — the 4 params are filters on the existing list, not a new resource; extending `GET /alerts` keeps `alerts.list` as the single source of truth. |
| Server-side full fetch (no `limit_for_cscli` scaling) — ask cscli for `limit` only then slice | Simpler argv but offset>0 yields empty beyond first page when native offset absent | Slice would return stale first page; overfetching to `limit+offset` capped at 100 lets `offset 25/50/75` return distinct slices without native flag. |
| Dedicated `GET /api/v1/alerts/timerange` + `GET /api/v1/decisions/timerange` | Groups time logic separately | Two new routes for what are query modifiers on the list — more surface to document and validate; single list with `since`/`until` is cleaner. |
| Skip time-range, ship #2 AppSec first | Valid — WAF visibility is high for AppSec hosts | Narrower audience; time-range unblocks every busy host regardless of AppSec, and reuses the same filter plumbing #2 would also need (validation, pagination). Time-range is the smaller, safer next slice; AppSec follows immediately after. |
| Add Prometheus-style `?query=` / `?q=` free-text search | Would search message/scenario/IP in one param | Ambiguous triage — explicit `scenario_contains` is narrower and audit-friendly; free-text `q` can be added later as syntactic sugar over the same server-side filter. |

## 11. File Map (final — top proposal)

| Status | Paths |
|--------|-------|
| Modified | `backend/routers/alerts/list.py`, `backend/routers/decisions/list.py`, `frontend/src/hooks/useAlerts.ts`, `frontend/src/hooks/useDecisions.ts`, `frontend/src/pages/Alerts.tsx`, `frontend/src/pages/Decisions.tsx`, `frontend/src/components/FiltersBar.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `backend/config.py`, `backend/errors.py`, `backend/static.py`, `backend/routers/cscli.py`, `config.yaml`, `deploy/config.example.yaml`, `deploy/ecosystem.config.cjs`, `frontend/src/lib/api/{client,types}.ts`, `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx` |
| Explicitly not created | `backend/tests/`, new DB, Prometheus exporters, Grafana dashboards, `docs/command-matrix.md`, auth/session files, new systemd unit |

## 12. How to Proceed — User Selection

This plan presents **5 ranked candidates**; the user should pick one to implement next.

- **Recommended:** #1 Time-Range & Search + Pagination (this plan is already detailed for it — implementation can start on approval).
- **To select a different candidate:** reply with the candidate number/name — the plan will be refined to detail that feature to the same depth (interfaces, tasks, file map, verification) before implementation.
- **If no pick is made:** this research plan remains as the ranked backlog and the recommended next step is #1.
- **Kanban:** on selection, break down the chosen feature into `docs/kanban/2026-08-19_time-range-filtering/task-*.md` via `/plan-task-breakdown`.

## 13. Open Questions for Reviewer

1. Confirm A1: does `cscli alerts list --help` / `cscli decisions list --help` on target hosts expose `--since`/`--until` (or `--from`/`--to`), and what value format do they accept (ISO-8601 vs `6h` duration)?
2. Should `offset` cap stay at 10000, or is 5000 sufficient for an in-memory slice over ≤100 rows? Plan proposes 10000 to match no practical cap.
3. Should `scenario_contains` be combined with `scenario` as AND (plan) or as OR / replacement? Plan keeps both as AND (exact + substring).
4. Should `since`/`until` use `datetime-local` pickers (plan) or free-text `6h`/`1d` duration inputs? Plan uses `datetime-local` → ISO-8601 with additional raw duration acceptance at the API layer.
5. Should unknown-key strict 400 be backfilled for alerts/decisions only now, or applied to all list routes at once? Plan applies only to the two extended routes.

---

## Appendix — Verification Checklist (copy into PR description)

- [ ] `cscli alerts list --help` / `cscli decisions list --help` checked; `since`/`until` pass-through vs fallback decided per §5.2
- [ ] `uvicorn` boots, `GET /api/v1/capabilities` still 16 keys (no new probe)
- [ ] `GET /api/v1/alerts?limit=50` still 200 `{"operation":"alerts.list","result":[...]}`
- [ ] `GET /api/v1/alerts?limit=50&since=2026-08-19T00:00:00Z&until=2026-08-19T23:59:59Z` → 200 filtered
- [ ] `GET /api/v1/alerts?limit=50&scenario_contains=ssh` → 200 substring-filtered (case-insensitive)
- [ ] `GET /api/v1/alerts?limit=25&offset=25` → 200 distinct slice vs offset 0; `offset` resets to 0 when filters change
- [ ] `GET /api/v1/decisions` mirror: `since`/`until` + `scenario_contains` + `offset` working
- [ ] `GET /api/v1/alerts?bad=1` → 400 `invalid_parameters`; `?limit=50&limit=100` → 400; `?since=not-a-date` → 400; `?scenario_contains=` + 65 chars → 400; `?offset=-1` → 400; no `cscli` spawn on any 400
- [ ] Stderr never appears in any response body
- [ ] `npm run typecheck` + `npm run build` green
- [ ] `/alerts` and `/decisions` pages: `datetime-local` pickers + `Scenario contains` input + Prev/Next pagination working, filters AND, Clear resets all + offset
- [ ] Old routes (`/bouncers`, `/machines`, `/allowlists`, `/status/*`, `/capabilities`, `/health`, `/metrics`, `/hub`, `/simulation`, static SPA) still green
