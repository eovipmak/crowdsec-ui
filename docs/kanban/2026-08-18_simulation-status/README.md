# Kanban: Simulation Status Visibility — `GET /api/v1/simulation`

Source plan: `docs/plans/2026-08-18_feature-research-and-next-candidates.md` (Feature Candidate #1 — Simulation Status Visibility, user-selected 2026-08-18).
Created: 2026-08-18
Tasks: 6 (`task-01.md` … `task-06.md`)

## How to use this kanban

- Each `task-NN.md` is self-contained: objective, prerequisites, owner, files, steps, contracts, acceptance criteria, verification commands, out-of-scope, reviewer. An agent must read its own file PLUS its prerequisite task files. Do NOT infer requirements from the plan alone.
- If a prerequisite is missing or the contract differs from what the task describes, STOP and report the blocker. Do not guess.
- **NO PYTEST, NO `backend/tests/`** (same as the `2026-08-15_fastapi-rebuild`, `2026-08-16_metrics-endpoint`, `2026-08-17_hub-inventory`, `2026-08-17_inspection-drilldown` boards). Verification is manual: `uv` boot + `curl`/`TestClient`, `npm run typecheck` + `npm run build`, and a browser walkthrough. Do NOT create files under `backend/tests/`.
- A task is complete only when (a) all acceptance criteria pass, (b) verification commands run green or are honestly reported unavailable with reason, AND (c) the agent appends a `## Coordinator status` block at the bottom of its task file.
- Out-of-scope lists are binding. Do not broaden scope.
- Do not commit or push. Leave changes in the working tree.

## Scope summary

Implements the read-only Simulation Status feature per plan §1 and §3:

- One capability label `simulation.status` + Probe #6 (`cscli simulation status`, 5 s, text check) cached at startup in `app.state.capabilities`.
- `GET /api/v1/simulation` through the existing `CscliRunner` / envelope / capabilities pattern (no shell, no stderr leak, query rejection on unknown/duplicate keys, `Cache-Control: no-store`, text parse → `{global, scenarios, raw}`).
- Frontend hook `useSimulation()` with typed `SimulationResult` + amber banners in `/overview` and `/decisions` (hidden when OFF or unsupported, no new route/nav).
- Docs updated (`docs/architecture.md`, `docs/operations-reference.md`); **no** mutations (`simulation enable/disable`), **no** new YAML config keys, **no** Docker/K8s, **no** DB, **no** auth/session changes (plan §1 Non-Goals, taste: lean internal tools).

## Dependency waves and parallelization

- **Wave 0:** `task-01` (envelope `SIMULATION_STATUS` + Probe #6) — MUST complete first.
- **Wave 1 [parallel — disjoint files]:**
  - `task-02` (simulation router — `backend/routers/simulation/*`) — depends on task-01.
  - `task-04` (frontend hook + types — `frontend/src/lib/api/types.ts` + `frontend/src/hooks/useSimulation.ts`) — depends on task-01; disjoint from task-02.
  So `{task-02, task-04}` can run in parallel after task-01.
- **Wave 2 — critical wire:**
  - `task-03` (wire router into `backend/main.py`) — depends on task-02. Do NOT run until task-02's `router: APIRouter(prefix="/simulation")` export exists.
- **Wave 3:**
  - `task-05` (frontend banners — `frontend/src/pages/Overview.tsx`, `Decisions.tsx`) — depends on task-04.
  - `task-05` can start as soon as task-04 completes, even while task-03 is in flight (no file overlap: task-03 touches `backend/main.py` only; task-05 touches `frontend/src/pages/*` only) — so `{task-03, task-05}` is a valid parallel pair once both their prerequisites are met.
- **Wave 4:**
  - `task-06` (docs — `docs/architecture.md`, `docs/operations-reference.md`) — depends on task-03 + task-05 (needs final API + frontend surface). No file overlap with anything else after those waves.

**Critical path:** `task-01 → task-02 → task-03` (backend wire), with `task-01 → task-04 → task-05` (frontend) parallel to that backend path. `task-06` closes after both. Single agent can do `task-01 → task-02 → task-04 → task-03 → task-05 → task-06` sequentially (3 backend files + 3 frontend files + 2 docs per plan §6).

## Parallelizable groups (disjoint files)

- `{task-02, task-04}` after task-01 — `backend/routers/simulation/*` vs `frontend/src/lib/api/types.ts` + `frontend/src/hooks/useSimulation.ts`.
- `{task-03, task-05}` once each branch's prerequisite is met — `backend/main.py` vs `frontend/src/pages/Overview.tsx` + `Decisions.tsx`.

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
| New | `backend/routers/simulation/__init__.py`, `backend/routers/simulation/status.py`, `frontend/src/hooks/useSimulation.ts` |
| Modified | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `frontend/src/lib/api/types.ts`, `frontend/src/pages/Overview.tsx`, `frontend/src/pages/Decisions.tsx`, `docs/architecture.md`, `docs/operations-reference.md` |
| Unchanged | `backend/config.py`, `backend/errors.py`, `backend/static.py`, `config.yaml`, `deploy/config.example.yaml`, `deploy/ecosystem.config.cjs` |

## Verification (board-wide — mirrors `docs/plans/2026-08-18_feature-research-and-next-candidates.md` §7)

```bash
# Backend wire (from backend/, no pytest)
uv sync
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090
curl -s http://127.0.0.1:8090/api/v1/health  # → {"status":"ok"}
curl -s http://127.0.0.1:8090/api/v1/capabilities | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'simulation.status' in d['result'] and len(d['result'])==16; print('ok 16')"
curl -s http://127.0.0.1:8090/api/v1/simulation | python3 -m json.tool | head -n 40  # → {"operation":"simulation.status","result":{"global":bool,"scenarios":[],"raw":"..."}}
curl -i -s http://127.0.0.1:8090/api/v1/simulation | grep -i cache-control  # → no-store
curl -i -s "http://127.0.0.1:8090/api/v1/simulation?unknown=1" | head -n 5  # → HTTP 400 invalid_parameters
curl -i -s "http://127.0.0.1:8090/api/v1/simulation?x=1&x=2" | head -n 5  # → HTTP 400
# Stderr never leaked (only stdout-derived raw on success)
curl -s http://127.0.0.1:8090/api/v1/simulation 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'operation' in d; print('envelope ok')"

# Frontend (from frontend/)
npm install
npm run typecheck  # → green
npm run build      # → green; dist/index.html + dist/assets/*.js exist
npm run dev        # walk /overview (banner when simulation ON, hidden when OFF) + /decisions (callout when ON) + degraded unsupported (banners hidden)

# Docs
grep -n "simulation.status" docs/architecture.md docs/operations-reference.md
grep -n "GET.*/simulation" docs/operations-reference.md
grep -n "Probe #6" docs/architecture.md
grep -rn "/api/v1/simulation" docs/ deploy/ 2>&1 | head
```

## Repository state before this kanban

`backend/` at post-`2026-08-17` state: `envelope.py` with 16 labels (`ALERTS_LIST` … `HUB_LIST`), `capabilities.py` with probes #1–#5 (15 capability keys exposed), `routers/cscli.py` with `CscliRunner`, `routers/metrics/show.py` and `routers/hub/list.py` wired in `main.py`, `frontend/` with Vite 6 + React 19 + TS strict + Tailwind v4 + React Router 7 + TanStack Query v5 and 8 pages (`overview/alerts/decisions/machines/bouncers/allowlists/metrics/hub`) plus inspect dialogs. No `backend/tests/`, no DB, no mutations.
