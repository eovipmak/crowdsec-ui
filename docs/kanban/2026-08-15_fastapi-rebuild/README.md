# Kanban: Greenfield rebuild — FastAPI + React SPA (read-only, slim scope)

Source plan: `docs/plans/2026-08-15_fastapi-rebuild.md` (rewritten 2026-08-15, slim scope — see plan §11 for the full Drop list).
Created: 2026-08-15 (rewrite; supersedes the prior 13-task board).
Tasks: 11 (`task-01.md` … `task-11.md`). The prior `task-12.md` and `task-13.md` are stale; DELETE them after rewriting.

## How to use this kanban

- Each `task-NN.md` is self-contained: objective, prerequisites, owner, files, steps, contracts, acceptance criteria, verification commands, out-of-scope, coordinator status.
- An agent starting a task must read its own file PLUS its prerequisite task files. Do NOT infer requirements from the plan alone.
- If a prerequisite is missing or the contract differs from what the task describes, STOP and report the blocker. Do not guess.
- **NO PYTEST, NO UNIT TESTS** (plan D12). Verification is manual: `uv sync`, `uvicorn` boot + `curl`, `npm run build`, and a browser walkthrough. Do NOT create files under `backend/tests/`.

## Scope summary

DROPPED from this kanban vs the prior 13-task board:
- command-matrix doc (no task).
- auth/session/CSRF/login + bcrypt + auth-config schema (no task).
- mutations + forbidden-flag validator (no task).
- `/metrics/{component}` endpoint (no task).
- pytest suite, unit tests, `backend/tests/`, `tests/fixtures/fake-cscli` (no task).
- Go code cleanup (already done by user — no task).
- cscli live smoke-pass doc artifact (subsumed by startup probes — no task).

RETAINED from the prior board:
- capabilities + `/capabilities` endpoint (cached startup probes).
- `/status/lapi`, `/status/capi`, `/health`.
- read op transforms for alerts/decisions/machines/bouncers/allowlists (in-place envelope wrapping of the existing prototype).
- static serving with SPA fallback, cache headers, traversal guard.
- frontend scaffold + 6 read-only pages.
- deploy artifacts + docs (slim schema).

## Dependency waves

- **Wave 0:** `task-01` (foundation: pyproject + config + envelope + errors).
- **Wave 1 [parallel]:** `task-02` (cscli runner upgrade), `task-09` (frontend scaffold — depends only on the envelope contract in task-01).
- **Wave 2 [parallel]:** `task-03` (capabilities module), `task-05` (status routers), `task-06` (alerts+bouncers migration), `task-07` (decisions+machines+allowlists migration) — all depend on task-02; disjoint files; NONE modify `backend/main.py` (those `include_router(...)` calls are owned by task-04).
- **Wave 3 [parallel]:** `task-04` (main.py rewrite — `/api/v1` prefix, lifespan wiring, include every module produced in Waves 1–2) AND `task-10` (frontend pages — depends only on task-09).
- **Wave 4:** `task-08` (static serving — depends on task-04 for root mount order).
- **Wave 5:** `task-11` (deploy + docs — depends on task-04, task-08, task-10).

## Parallelizable groups (disjoint files)

- {`task-02`, `task-09`} after task-01 — `backend/routers/cscli.py` vs the entire `frontend/` tree.
- {`task-03`, `task-05`, `task-06`, `task-07`} after task-02 — `backend/capabilities.py`, `backend/routers/status.py`, `backend/routers/{alerts,bouncers}/*`, `backend/routers/{decisions,machines,allowlists}/*`. NONE touch `backend/main.py` (they expose router objects at module scope; task-04 imports + includes them).
- {`task-04`, `task-10`} — disjoint (`backend/main.py` vs `frontend/src/**`).

## Owner → task matrix

| Task | Owner agent | Primary reviewer |
|---|---|---|
| task-01 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-02 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-03 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-04 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-05 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-06 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-07 | crowdsec-command-mapper | crowdsec-documentation-reviewer |
| task-08 | native-deployment-operator | crowdsec-documentation-reviewer |
| task-09 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-10 | nextjs-dashboard | crowdsec-documentation-reviewer |
| task-11 | native-deployment-operator | crowdsec-documentation-reviewer |

## Repository state (current, before this kanban executes)

`backend/` contains a partial FastAPI prototype (kept; upgraded in-place per plan D1):
- `backend/pyproject.toml` — only `fastapi[standard]` declared; Python `>=3.14` (will be relaxed to `>=3.12`).
- `backend/main.py` — wires 11 GET routers; NO `/api/v1` prefix; lifespan absent.
- `backend/routers/cscli.py` — `async run_cscli(*args)` helper using `asyncio.create_subprocess_exec("cscli", *args)`; raises `HTTPException(500, detail=stderr.decode())` — THIS LEAKS STDERR and must be fixed in task-02.
- `backend/routers/{alerts,decisions,machines,bouncers,allowlists}/` — 11 GET endpoints with sensible field-flattening transforms already coded.
- The `src/` dir at `backend/src/backend/__init__.py` is an empty placeholder; safe to leave or delete in task-11 cleanup (out of scope here — do NOT touch).

No `backend/tests/`, no `backend/app/`, no `deploy/`, no Vite `frontend/` scaffold yet.

## Conventions for all tasks

- Backend deps via `uv` (`backend/uv.lock` regenerates on `uv sync`).
- Frontend stack (exact): Vite 6, React 19, TypeScript strict, Tailwind v4 CSS-first, shadcn/ui in-repo (`frontend/src/components/ui/*`), React Router 7, TanStack Query v5, native `fetch`. NO Next.js, NO axios.
- No pytest, no `backend/tests/`. Each task's verification section lists manual commands only; the coordinator treats a non-green verification as "not complete".
- A task is complete only when (a) all acceptance criteria pass, (b) verification commands run green or are honestly reported unavailable with reason, AND (c) the coordinator status block (at the bottom of each task file) is appended.
- Out-of-scope lists are binding. Do not broaden scope.
- Do not commit or push. Leave changes in the working tree.
