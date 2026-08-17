# Kanban: Inspect Completion & Drill-Down Views — `allowlists.inspect` / `machines.inspect` / `bouncers.inspect`

Source plan: `docs/plans/2026-08-17_feature-research-and-inspection-drilldown.md` (Candidate #1 — Inspect Completion & Drill-Down Views, selected).
Created: 2026-08-17
Tasks: 5 (`task-01.md` … `task-05.md`)

## How to use this kanban

- Each `task-NN.md` is self-contained: objective, prerequisites, owner, files, steps, contracts, acceptance criteria, verification commands, out-of-scope, reviewer. An agent must read its own file PLUS its prerequisite task files. Do NOT infer requirements from the plan alone.
- If a prerequisite is missing or the contract differs from what the task describes, STOP and report the blocker. Do not guess.
- **NO PYTEST, NO `backend/tests/`** (same as the `2026-08-15_fastapi-rebuild`, `2026-08-16_metrics-endpoint`, and `2026-08-17_hub-inventory` boards). Verification is manual: `uv` boot + `curl`/`TestClient`, `npm run typecheck` + `npm run build`, and a browser walkthrough. Do NOT create files under `backend/tests/`.
- A task is complete only when (a) all acceptance criteria pass, (b) verification commands run green or are honestly reported unavailable with reason, AND (c) the agent appends a `## Coordinator status` block at the bottom of its task file.
- Out-of-scope lists are binding. Do not broaden scope.
- Do not commit or push. Leave changes in the working tree.

## Scope summary

Completes the frontend inspection and item drill-down for three existing backend operations (plan §1.2, §4–§6):

- **Allowlists entries drill-down** — expand an allowlist card/row to display its `items` (`value`, `description`, `created_at`, `expiration`) via `GET /api/v1/allowlists/inspect/{name}` (`allowlists.inspect`), eliminating SSH to see whitelisted IPs/CIDRs.
- **Machine detail dialog** — inspect dialog on `/machines` via `GET /api/v1/machines/inspect/{machine_id}` (`machines.inspect`), showing machineId, IP, OS, version, isValidated, auth_type, timestamps, and datasources when present.
- **Bouncer detail dialog** — inspect dialog on `/bouncers` via `GET /api/v1/bouncers/inspect/{name}` (`bouncers.inspect`), showing name, type, version, IP, OS, auth_type, revoked, auto_created, and last pull.

Backend inspect routes already exist (`backend/routers/allowlists/inspect.py`, `backend/routers/machines/inspect.py`, `backend/routers/bouncers/inspect.py`) — this board is frontend hooks + UI + verification only. **No mutations**, **no** new backend routes, **no** new config keys, **no** Docker/K8s, **no** DB, **no** auth/session changes (plan §1.3 Non-Goals, taste: lean internal tools).

## Dependency waves and parallelization

- **Wave 0:** `task-01` (hook extensions + typed contracts) — MUST complete first. Establishes `useAllowlistInspect`, `useMachineInspect`, `useBouncerInspect` and `AllowlistItem`/`AllowlistDetail`/`MachineDetail`/`BouncerDetail` types.
- **Wave 1 [parallel — disjoint files]:**
  - `task-02` (allowlist entries view — `frontend/src/pages/Allowlists.tsx`) — depends on task-01. Touches only `Allowlists.tsx`.
  - `task-03` (machine inspect dialog — `frontend/src/pages/MachineInspectDialog.tsx` + `frontend/src/pages/Machines.tsx`) — depends on task-01. Touches only `MachineInspectDialog.tsx` + `Machines.tsx`.
  - `task-04` (bouncer inspect dialog — `frontend/src/pages/BouncerInspectDialog.tsx` + `frontend/src/pages/Bouncers.tsx`) — depends on task-01. Touches only `BouncerInspectDialog.tsx` + `Bouncers.tsx`.
  So `{task-02, task-03, task-04}` can run in parallel after task-01 (no file overlap).
- **Wave 2:**
  - `task-05` (verification, a11y, backend contract check) — depends on task-02 + task-03 + task-04 (needs all three surfaces). Fixes only a11y/type/build regressions; verifies keyboard, ARIA, responsive, and backend contracts.

**Critical path:** `task-01 → {task-02, task-03, task-04} → task-05`. Single agent can do `task-01 → task-02 → task-03 → task-04 → task-05` sequentially (3 hook files + 5 page/dialog files per plan §4.2).

## Parallelizable groups (disjoint files)

- `{task-02, task-03, task-04}` after task-01 — `Allowlists.tsx` vs `MachineInspectDialog.tsx`+`Machines.tsx` vs `BouncerInspectDialog.tsx`+`Bouncers.tsx`. No file overlap; safe to run with three agents.

## Owner → task matrix

| Task | Owner agent | Primary reviewer |
|---|---|---|
| task-01 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-02 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-03 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-04 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-05 | nextjs-dashboard + crowdsec-documentation-reviewer | crowdsec-documentation-reviewer |

## Plan-anchored file map

| Status | Paths |
|--------|-------|
| New | `frontend/src/pages/MachineInspectDialog.tsx`, `frontend/src/pages/BouncerInspectDialog.tsx` |
| Modified | `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts`, `frontend/src/pages/Allowlists.tsx`, `frontend/src/pages/Machines.tsx`, `frontend/src/pages/Bouncers.tsx` |
| Verified (read-only) | `backend/routers/allowlists/inspect.py`, `backend/routers/machines/inspect.py`, `backend/routers/bouncers/inspect.py` |
| Unchanged | `backend/envelope.py`, `backend/capabilities.py`, `backend/main.py`, `backend/config.py`, `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/types.ts` (unless trivial import fix needed), `frontend/src/components/ui/dialog.tsx`, `frontend/src/components/DataTable.tsx`, `config.yaml`, `deploy/config.example.yaml` |

## Verification (board-wide — mirrors plan §7)

```bash
# Frontend (from frontend/)
npm install
npm run typecheck  # → green (zero errors)
npm run build      # → green; dist/index.html + dist/assets/*.js exist
npm run dev        # walk /allowlists + /machines + /bouncers

# Walkthrough:
# /allowlists → click View entries on vnh_ip → entries table (Value/Description/Created At/Expiration); empty allowlist shows "No entries in this allowlist"; sentinel expiration renders as —/Never; keyboard open/close works.
# /machines → click row / press Enter → dialog with machineId, OS, version, heartbeat, validated; Escape closes; missing datasources shows muted note.
# /bouncers → click row / press Enter → dialog with name, type, exact version, OS, last pull; Escape closes.

# Backend contracts (from backend/, read-only — no code change expected)
uv run python -m py_compile routers/allowlists/inspect.py routers/machines/inspect.py routers/bouncers/inspect.py
# Optional smoke with running server + cscli:
DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &
curl -s http://127.0.0.1:8090/api/v1/allowlists/inspect/vnh_ip | python3 -m json.tool | head -n 40
curl -s http://127.0.0.1:8090/api/v1/machines/inspect/central-api | python3 -m json.tool | head -n 40
curl -s http://127.0.0.1:8090/api/v1/bouncers/inspect/linux-fw-01 | python3 -m json.tool | head -n 40
```

## Repository state before this kanban

`backend/` at post-`2026-08-17_hub-inventory` state: `envelope.py` with 16 labels (`capabilities.list` + 15 probed ops including `HUB_LIST`), `capabilities.py` with probes #1–#5, `routers/allowlists/inspect.py` + `routers/machines/inspect.py` + `routers/bouncers/inspect.py` wired in `main.py`, `frontend/` with Vite 6 + React 19 + TS strict + Tailwind v4 + React Router 7 + TanStack Query v5 and 8 pages (`overview/alerts/decisions/machines/bouncers/allowlists/metrics/hub`), `AlertInspectDialog.tsx` as the reference dialog pattern, `DataTable.tsx` with `onRowClick` keyboard support, `dialog.tsx` via Radix. No `backend/tests/`, no DB, no mutations.
