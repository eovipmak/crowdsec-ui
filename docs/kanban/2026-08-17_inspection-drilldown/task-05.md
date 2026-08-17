# Task 05 — Verification, a11y, and backend contract check

## Objective

Verify the three drill-down surfaces end-to-end: allowlist entries table, machine inspect dialog, and bouncer inspect dialog. Confirm keyboard navigation, ARIA attributes, responsive layout, and that the existing backend inspect contracts still match the frontend types. Fix only a11y/type/build regressions introduced by tasks 01–04; do not add new features.

## Prerequisites/dependencies

- task-02 COMPLETED — `frontend/src/pages/Allowlists.tsx` drill-down present.
- task-03 COMPLETED — `frontend/src/pages/MachineInspectDialog.tsx` + `Machines.tsx` wiring present.
- task-04 COMPLETED — `frontend/src/pages/BouncerInspectDialog.tsx` + `Bouncers.tsx` wiring present.
- task-01 COMPLETED (transitively via 02–04).

If any of the above files are missing or `npm run typecheck` fails due to a prerequisite task, STOP, report the blocker, do not guess or reimplement missing files.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard` (a11y + build verification) + `crowdsec-documentation-reviewer` (contract review)
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **VERIFY** (read-only): `backend/routers/allowlists/inspect.py`, `backend/routers/machines/inspect.py`, `backend/routers/bouncers/inspect.py` — confirm response schemas match plan §5.1–§5.3 and the frontend `AllowlistDetail`/`MachineDetail`/`BouncerDetail` types. If a mismatch is found (e.g. `machines.inspect` popping `datasources` causing an expected field to be absent), log it in the Coordinator status block and handle it defensively in the UI (tasks 02–04 already do); do NOT edit `backend/**` in this task unless the fix is a trivial serialization key rename that preserves the existing operation label and envelope.
- **FIX-ONLY** (if needed): minor a11y/build fixes in `frontend/src/pages/Allowlists.tsx`, `frontend/src/pages/MachineInspectDialog.tsx`, `frontend/src/pages/Machines.tsx`, `frontend/src/pages/BouncerInspectDialog.tsx`, `frontend/src/pages/Bouncers.tsx`, `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts`, and shared components `frontend/src/components/DataTable.tsx` / `frontend/src/components/ui/dialog.tsx` (e.g. missing `aria-label`, `role`, `tabIndex`, focus return, or `mono`/`tabular` token drift). No new components or routes.

Do NOT create new pages, hooks, or backend routes. Do NOT add mutations, config keys, Docker/K8s, DB, auth/session, or observability infra. Do NOT create `backend/tests/` or pytest files (board-wide rule).

## Concrete implementation steps

1. Read all files from tasks 01–04 plus `frontend/src/components/DataTable.tsx`, `frontend/src/components/ui/dialog.tsx`, `frontend/src/pages/AlertInspectDialog.tsx` (reference for correct a11y pattern), and the three backend inspect routers.
2. Backend contract check (read-only):
   - `backend/routers/allowlists/inspect.py` — verify `success(ALLOWLISTS_INSPECT, {name, description, created_at, updated_at, items: a.get("items",[])})` matches `AllowlistDetail` (plan §5.1). Note: `items` items have `value`, `description`, `created_at`, `expiration`.
   - `backend/routers/machines/inspect.py` — note that `machine.pop("datasources", None)` and `machine.pop("metrics", None)` mean the frontend must not require `datasources` (task-03 handles this). Verify remaining keys match `MachineDetail` (plan §5.2).
   - `backend/routers/bouncers/inspect.py` — verify `success(BOUNCERS_INSPECT, data)` where `data` is `json.loads(stdout)` from `cscli bouncers inspect {name} -o json` matches `BouncerDetail` (plan §5.3).
   - If any router's `prefix` or `operation` constant has drifted, record it in Coordinator status and do not silently fix the frontend path — report the blocker.
3. Frontend a11y + responsive checks:
   - `Allowlists.tsx` drill-down trigger: has `aria-label="View entries for ${name}"`, is keyboard-activatable (Enter/Space), and focus is managed when opening/closing. If inline expansion, the content has `role="region"` and `aria-live="polite"` or equivalent.
   - `Machines.tsx` / `Bouncers.tsx` `DataTable onRowClick`: `DataTable.tsx` already sets `role="button"`, `tabIndex=0`, `aria-label="Inspect row ${key}"`, and `onKeyDown` for Enter/Space — confirm the wiring is present and not overridden.
   - `MachineInspectDialog.tsx` / `BouncerInspectDialog.tsx` `Dialog`: `open={key !== null} onOpenChange={(open)=>{if(!open) onClose()}}`, `DialogContent` has correct `max-h`/`overflow` for mobile, `DialogTitle`/`DialogDescription` present for screen readers, close button has `sr-only` label, Escape and overlay click close the dialog.
   - Responsive: dialog uses `w-[calc(100%-32px)] max-w-3xl` and scroll container `max-h-[68vh] overflow-y-auto`; tables use `break-all`/`break-words` for long values; no horizontal overflow on mobile.
   - Color/contrast: uses existing dark tokens (`bg-[#12121a]`, `border-[#232334]`, `text-zinc-*`), not new ad-hoc colors.
4. Build verification:
   - Run `npm run typecheck` and `npm run build` in `frontend/`; fix any type errors or missing imports introduced by tasks 01–04 (e.g. unused imports, missing `Column` generic, `ApiError` handling). Do not suppress errors with `// @ts-ignore` or `any` — fix the types.
5. Manual walkthrough checklist (record pass/fail in Coordinator status):
   - `/allowlists` → open `vnh_ip` entries → table shows Value/Description/Created At/Expiration; empty allowlist shows `No entries`; sentinel expiration renders as `—`/`Never`; keyboard open/close works.
   - `/machines` → click row / press Enter → dialog shows machineId, IP, OS, version, validated, auth_type, timestamps; missing datasources shows muted note; Escape closes.
   - `/bouncers` → click row / press Enter → dialog shows name, type, version, IP, OS, revoked/auto_created, timestamps, last_pull; Escape closes.
   - `npm run typecheck` zero errors, `npm run build` succeeds.

## Interfaces/contracts and integration points

- Backend inspect endpoints (read-only verification):
  - `GET /api/v1/allowlists/inspect/{name}` → `operation: "allowlists.inspect"` (plan §5.1)
  - `GET /api/v1/machines/inspect/{machine_id}` → `operation: "machines.inspect"` (plan §5.2)
  - `GET /api/v1/bouncers/inspect/{name}` → `operation: "bouncers.inspect"` (plan §5.3)
- Frontend hooks from task-01: `useAllowlistInspect`, `useMachineInspect`, `useBouncerInspect` — all use `apiGet` envelope unwrapping and `ApiError` for failures.
- Shared UI contracts: `Dialog` (`@radix-ui/react-dialog` via `frontend/src/components/ui/dialog.tsx`), `DataTable` (`frontend/src/components/DataTable.tsx`), `LoadingSkeleton`, `ErrorPanel`, `CapabilityBadge`.

## Acceptance criteria

- `npm run typecheck` in `frontend/` passes with zero errors.
- `npm run build` in `frontend/` succeeds; `dist/index.html` and `dist/assets/*` exist.
- All three drill-down surfaces pass the manual walkthrough checklist above (keyboard, ARIA, responsive, loading/error/empty states, sentinel handling).
- Backend contract check is documented in Coordinator status: either "contracts match plan §5.1–§5.3" or explicit mismatches noted (e.g. `machines.inspect` datasource pop) with defensive handling confirmed.
- No new routes, mutations, config keys, or `backend/**` behavior changes beyond trivial serialization fixes (if any).

## Verification commands/checks

From `frontend/`:

- `npm run typecheck`
- `npm run build`
- `grep -n "aria-label\|role=\"button\"\|onKeyDown" src/pages/Allowlists.tsx src/pages/Machines.tsx src/pages/Bouncers.tsx src/pages/MachineInspectDialog.tsx src/pages/BouncerInspectDialog.tsx` → a11y attributes present.
- `grep -n "encodeURIComponent" src/hooks/useAllowlists.ts src/hooks/useMachines.ts src/hooks/useBouncers.ts` → path encoding present.

From `backend/` (read-only):

- `uv run python -m py_compile routers/allowlists/inspect.py routers/machines/inspect.py routers/bouncers/inspect.py` → no syntax errors.
- Optional smoke (requires running server + cscli):
  ```bash
  DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &
  curl -s http://127.0.0.1:8090/api/v1/allowlists/inspect/vnh_ip | python3 -m json.tool | head -n 40
  curl -s http://127.0.0.1:8090/api/v1/machines/inspect/central-api | python3 -m json.tool | head -n 40
  curl -s http://127.0.0.1:8090/api/v1/bouncers/inspect/linux-fw-01 | python3 -m json.tool | head -n 40
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (contract + a11y + read-only invariant)

## Explicit out-of-scope

- Adding new features, pages, hooks, or backend routes beyond tasks 01–04.
- Fixing `backend/routers/machines/inspect.py` to restore `datasources` — defensive UI handling is sufficient for this board; file a follow-up if needed.
- Mutations (`allowlists add/delete`, `machines delete`, `bouncers delete`, `decisions delete`), new YAML config keys, Docker/K8s, DB, LDAP/OIDC/RBAC, Prometheus/Grafana.
- Creating `backend/tests/` or pytest files — board-wide rule: verification is `typecheck` + `build` + manual walkthrough.
- Broad refactors of `DataTable` or `dialog.tsx` beyond minimal a11y fixes.

## Coordinator status

- Status: completed
- Completed by: kanban-task-coordinator (nextjs-dashboard agent)
- Completed at: 2026-08-17T00:00:00Z
- Verification: npm run typecheck green (zero errors); npm run build green (1730 modules, dist/index.html + dist/assets/* exist); grep aria-label/role/onKeyDown present (DataTable + Allowlists); grep encodeURIComponent in 3 hooks present; uv python -m py_compile 3 inspect routers green; backend contracts match plan §5.1-§5.3 (datasources pop noted/defensive), a11y overflow-x-hidden fix + datasources any->unknown
- Commit or artifact reference: working tree (frontend/src/hooks/useMachines.ts, frontend/src/pages/MachineInspectDialog.tsx, frontend/src/pages/BouncerInspectDialog.tsx; verified Allowlists/Machines/Bouncers + 3 inspect routers)
