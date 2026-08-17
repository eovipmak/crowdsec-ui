# Kanban: Metrics endpoint — `GET /api/v1/metrics` + `GET /api/v1/metrics/{component}`

Source plan: `docs/plans/2026-08-16_metrics-endpoint.md` (revives dropped scope from `2026-08-15_fastapi-rebuild.md` §11 — `/metrics/{component}`).
Created: 2026-08-16
Tasks: 6 (`task-01.md` … `task-06.md`)

## How to use this kanban

- Each `task-NN.md` is self-contained: objective, prerequisites, owner, files, steps, contracts, acceptance criteria, verification commands, out-of-scope, reviewer. An agent must read its own file PLUS its prerequisite task files. Do NOT infer requirements from the plan alone.
- If a prerequisite is missing or the contract differs from what the task describes, STOP and report the blocker. Do not guess.
- **NO PYTEST, NO `backend/tests/`** (same as the `2026-08-15_fastapi-rebuild` board). Verification is manual: `uv` boot + `curl`/`TestClient`, `npm run typecheck` + `npm run build`, and a browser walkthrough. Do NOT create files under `backend/tests/`.
- A task is complete only when (a) all acceptance criteria pass, (b) verification commands run green or are honestly reported unavailable with reason, AND (c) the agent appends a `## Coordinator status` block at the bottom of its task file.
- Out-of-scope lists are binding. Do not broaden scope.
- Do not commit or push. Leave changes in the working tree.

## Scope summary

Revives `GET /metrics/{component}` with a lean read-only design (plan §1):

- One capability `metrics.show` (single label for both routes) + Probe #4 (`cscli metrics show acquisition -o json`, 5 s).
- Two routes (`GET /api/v1/metrics` + `GET /api/v1/metrics/{component}`) through the existing `CscliRunner` / envelope / capabilities pattern (no shell, no stderr leak, `Cache-Control: no-store`).
- Frontend hook `useMetrics(component?: string)` + page `/metrics` (All + 14 types, tables with `<pre>` fallback, capability badge, 30 s poll toggle).
- Docs updated; **no** config keys, **no** Docker/K8s, **no** DB, **no** Prometheus `/metrics` text exposition, **no** Grafana, **no** auth/session (plan §1 Non-Goals, taste: lean internal tools).

## Dependency waves and parallelization

- **Wave 0:** `task-01` (envelope `METRICS_SHOW` + Probe #4) — MUST complete first.
- **Wave 1 [parallel — disjoint files]:**
  - `task-02` (metrics router — `backend/routers/metrics/*`) — depends on task-01.
  - `task-04` (frontend hook + types — `frontend/src/lib/api/types.ts` + `frontend/src/hooks/useMetrics.ts`) — depends on task-01; disjoint from task-02.
  So `{task-02, task-04}` can run in parallel after task-01.
- **Wave 2 — critical wire:**
  - `task-03` (wire router into `backend/main.py`) — depends on task-02. Do NOT run until task-02's `router: APIRouter(prefix="/metrics")` export exists.
- **Wave 3:**
  - `task-05` (frontend page + nav + routing — `frontend/src/pages/Metrics.tsx`, `App.tsx`, `router.tsx`, `Layout.tsx`) — depends on task-04.
  - `task-05` can start as soon as task-04 completes, even while task-03 is in flight (no file overlap: task-03 touches `backend/main.py` only; task-05 touches `frontend/src/**` only) — so `{task-03, task-05}` is a valid parallel pair once both their prerequisites are met.
- **Wave 4:**
  - `task-06` (docs — `docs/architecture.md`, `docs/operations-reference.md`) — depends on task-03 + task-05 (needs final API + frontend route shapes). No file overlap with anything else after those waves.

**Critical path:** `task-01 → task-02 → task-03` (backend wire), with `task-01 → task-04 → task-05` (frontend) parallel to that backend path. `task-06` closes after both. Single agent can do `task-01 → task-02 → task-04 → task-03 → task-05 → task-06` sequentially (4 backend files + 5 frontend files + 2 docs per plan §6 lean staffing note).

## Parallelizable groups (disjoint files)

- `{task-02, task-04}` after task-01 — `backend/routers/metrics/*` vs `frontend/src/lib/api/types.ts` + `frontend/src/hooks/useMetrics.ts`.
- `{task-03, task-05}` once each branch's prerequisite is met — `backend/main.py` vs `frontend/src/pages/Metrics.tsx` + `App.tsx` + `router.tsx` + `Layout.tsx`.

## Owner → task matrix

| Task | Owner agent | Primary reviewer |
|---|---|---|
| task-01 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-02 | crowdsec-command-mapper | crowdsec-command-mapper + crowdsec-documentation-reviewer |
| task-03 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-04 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-05 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-06 | crowdsec-command-mapper / crowdsec-documentation-reviewer | crowdsec-documentation-reviewer |

## Plan-anchored file map

| Status | Paths |
|--------|-------|
| New | `backend/routers/metrics/__init__.py`, `backend/routers/metrics/show.py`, `frontend/src/hooks/useMetrics.ts`, `frontend/src/pages/Metrics.tsx` |
| Modified | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `frontend/src/lib/api/types.ts`, `frontend/src/App.tsx`, `frontend/src/router.tsx`, `frontend/src/components/Layout.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/config.py`, `backend/errors.py`, `backend/static.py`, `config.yaml`, `deploy/config.example.yaml` (optional comment only), `deploy/crowdsec-dashboard.service` |

## Verification (board-wide — mirrors `docs/plans/2026-08-16_metrics-endpoint.md` §7)

```bash
# Backend wire (from backend/, no pytest)
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'metrics.show' in d['result'] and len(d['result'])==14; print('ok 14')"
curl -s http://127.0.0.1:8090/api/v1/metrics | python3 -m json.tool | head -n 40  # → {"operation":"metrics.show","result":{...}}
curl -i -s http://127.0.0.1:8090/api/v1/metrics | grep -i cache-control  # → no-store
curl -s http://127.0.0.1:8090/api/v1/metrics/acquisition | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'acquisition' in d['result']"
curl -i -s http://127.0.0.1:8090/api/v1/metrics/foobar | head -n 5  # → HTTP 400 invalid_parameters
curl -i -s "http://127.0.0.1:8090/api/v1/metrics?unknown=1" | head -n 5  # → HTTP 400
# Stderr never leaked
curl -s http://127.0.0.1:8090/api/v1/metrics/bad 2>&1 | grep -q "unknown metrics type" && echo "FAIL leak" || echo "ok no leak"

# Frontend (from frontend/)
npm install
npm run typecheck  # → green
npm run build      # → green; dist/index.html + dist/assets/*.js exist
npm run dev        # walk /overview + /metrics (selector All + 14 types, degraded unsupported state, 30s poll toggle)

# Docs
grep -n "metrics.show" docs/architecture.md docs/operations-reference.md
grep -n "GET.*/metrics" docs/operations-reference.md
grep -rn "/api/v1/metrics" docs/ deploy/ 2>&1 | head
```

## Repository state before this kanban

`backend/` at post-`2026-08-15_fastapi-rebuild` (11-task) state: `envelope.py` with 14 ops, `capabilities.py` with probes #1–#3, `routers/cscli.py` with `CscliRunner`, `main.py` wired under `/api/v1` with static last, `frontend/` with Vite 6 + React 19 + TS strict + Tailwind v4 + React Router 7 + TanStack Query v5 and 6 pages (`overview/alerts/decisions/machines/bouncers/allowlists` + `Overview` polling). No `backend/tests/`, no Prometheus.
