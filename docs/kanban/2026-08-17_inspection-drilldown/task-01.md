# Task 01 — Inspect hooks + typed contracts (`useAllowlistInspect`, `useMachineInspect`, `useBouncerInspect`)

## Objective

Establish the frontend data contracts and TanStack Query hooks that all later UI tasks depend on. Add `AllowlistItem` / `AllowlistDetail` typing and `useAllowlistInspect(name)` to `useAllowlists.ts`, add `useMachineInspect(machine_id)` to `useMachines.ts`, and add `useBouncerInspect(name)` to `useBouncers.ts`. Each hook calls `apiGet` against the existing backend inspect endpoints, uses `enabled: <key> !== null && <key>.length > 0`, and unwraps the `{ operation, result }` envelope via `apiGet<T>`.

## Prerequisites/dependencies

- Wave 0 — no task prerequisite. Requires the following files at current `main` state (post-`2026-08-17_hub-inventory`): `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts`, `frontend/src/lib/api/client.ts:apiGet`, `backend/routers/allowlists/inspect.py`, `backend/routers/machines/inspect.py`, `backend/routers/bouncers/inspect.py`. If any of the three hook files are missing or the backend inspect routes have diverged (different prefix or envelope label), STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/hooks/useAllowlists.ts` — add `AllowlistItem` interface, refine `AllowlistDetail`, add `useAllowlistInspect(name: string | null)` hook.
- **MODIFY** `frontend/src/hooks/useMachines.ts` — add `MachineDetail` (or `MachineInspect`) interface extending `Machine` with inspect-only fields, add `useMachineInspect(machineId: string | null)` hook.
- **MODIFY** `frontend/src/hooks/useBouncers.ts` — add `BouncerDetail` interface extending `Bouncer`, add `useBouncerInspect(name: string | null)` hook.

Do NOT touch `frontend/src/pages/Allowlists.tsx` (task-02), `frontend/src/pages/Machines.tsx` (task-03), `frontend/src/pages/Bouncers.tsx` (task-04), any `frontend/src/pages/*InspectDialog.tsx` (tasks 03–04), `frontend/src/components/**`, or any `backend/**` (verification only — do not edit backend routers in this task; note mismatches instead).

## Concrete implementation steps

1. Read `frontend/src/hooks/useAllowlists.ts`, `frontend/src/hooks/useMachines.ts`, `frontend/src/hooks/useBouncers.ts`, `frontend/src/lib/api/client.ts`, `frontend/src/hooks/useAlerts.ts` (reference pattern for `useAlert(id)` with `enabled` guard), and `frontend/src/pages/AlertInspectDialog.tsx` (reference consumer of `useAlert`).
2. In `frontend/src/hooks/useAllowlists.ts`:
   - Add:
     ```ts
     export interface AllowlistItem {
       value: string;
       description: string;
       created_at: string;
       expiration: string;
     }
     export interface AllowlistDetail extends Allowlist {
       items: AllowlistItem[];
     }
     ```
   - Refine existing `AllowlistDetail.items` from `any[]` to `AllowlistItem[]`. Keep `Allowlist` and `useAllowlists()` / `useAllowlistCheck()` unchanged.
   - Add:
     ```ts
     export function useAllowlistInspect(name: string | null) {
       return useQuery<AllowlistDetail>({
         enabled: name !== null && name.length > 0,
         queryKey: ['allowlists', 'inspect', name],
         queryFn: () => apiGet<AllowlistDetail>(`/allowlists/inspect/${encodeURIComponent(name!)}`),
       });
     }
     ```
3. In `frontend/src/hooks/useMachines.ts`:
   - Keep existing `Machine` interface unchanged (preserve `machine_id`, `ip_address`, `os`, `version`, `auth_type`, `validated`, `datasources`, `created_at`, `last_heartbeat`, `last_push`).
   - Add `MachineDetail` that captures the inspect response as returned by `GET /api/v1/machines/inspect/{machine_id}` (plan §5.2). Model the known fields (`machineId`/`machine_id`, `ipAddress`/`ip_address`, `os`, `version`, `isValidated`/`validated`, `auth_type`, `created_at`, `updated_at`, `last_heartbeat`, `last_push`) with index signature for forward-compatible extra keys. Note: current `backend/routers/machines/inspect.py` pops `datasources`/`metrics` before responding — the frontend type must tolerate their absence (optional) and task-03 must handle missing datasources gracefully. Do NOT modify the backend in this task.
   - Add:
     ```ts
     export function useMachineInspect(machineId: string | null) {
       return useQuery<MachineDetail>({
         enabled: machineId !== null && machineId.length > 0,
         queryKey: ['machines', 'inspect', machineId],
         queryFn: () => apiGet<MachineDetail>(`/machines/inspect/${encodeURIComponent(machineId!)}`),
       });
     }
     ```
4. In `frontend/src/hooks/useBouncers.ts`:
   - Keep existing `Bouncer` interface unchanged.
   - Add `BouncerDetail` covering `GET /api/v1/bouncers/inspect/{name}` (plan §5.3: `name`, `type`, `ip_address`, `os`, `version`, `auth_type`, `revoked`, `auto_created`, `created_at`, `updated_at`, `last_pull`).
   - Add:
     ```ts
     export function useBouncerInspect(name: string | null) {
       return useQuery<BouncerDetail>({
         enabled: name !== null && name.length > 0,
         queryKey: ['bouncers', 'inspect', name],
         queryFn: () => apiGet<BouncerDetail>(`/bouncers/inspect/${encodeURIComponent(name!)}`),
       });
     }
     ```
5. Verify no unused imports are introduced and existing exports remain.

## Interfaces/contracts and integration points

- `GET /api/v1/allowlists/inspect/{name}` → `operation: "allowlists.inspect"`, `result: AllowlistDetail` (plan §5.1). Endpoint exists in `backend/routers/allowlists/inspect.py` at `GET /allowlists/inspect/{name}` under `/api/v1`.
- `GET /api/v1/machines/inspect/{machine_id}` → `operation: "machines.inspect"` (plan §5.2). Endpoint exists at `GET /machines/inspect/{machine_id}`.
- `GET /api/v1/bouncers/inspect/{name}` → `operation: "bouncers.inspect"` (plan §5.3). Endpoint exists at `GET /bouncers/inspect/{name}`.
- `apiGet<T>(path)` unwraps the success envelope and throws `ApiError` for operation-level (`HTTP 200 {operation, error}`) and request-level (`HTTP 4xx/5xx {error}`) failures — callers (tasks 02–04) handle `isLoading`/`error`/`refetch`.
- Query keys `['allowlists','inspect',name]`, `['machines','inspect',machineId]`, `['bouncers','inspect',name]` must be distinct from list keys `['allowlists']`, `['machines']`, `['bouncers']`.

## Acceptance criteria

- `frontend/src/hooks/useAllowlists.ts` exports `AllowlistItem`, `AllowlistDetail` (with `items: AllowlistItem[]`), and `useAllowlistInspect(name: string | null)` with `enabled` guard and `encodeURIComponent` path.
- `frontend/src/hooks/useMachines.ts` exports `MachineDetail` and `useMachineInspect(machineId: string | null)` with `enabled` guard and `encodeURIComponent` path.
- `frontend/src/hooks/useBouncers.ts` exports `BouncerDetail` and `useBouncerInspect(name: string | null)` with `enabled` guard and `encodeURIComponent` path.
- Existing hooks `useAllowlists`, `useAllowlistCheck`, `useMachines`, `useBouncers` remain unchanged and still compile.
- No `any` in the new `AllowlistItem` fields; `MachineDetail`/`BouncerDetail` may use `unknown` or optional fields for forward compatibility but must type all fields listed in plan §5.2–§5.3.
- `npm run typecheck` in `frontend/` passes with zero errors.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green (zero errors).
- `grep -n "useAllowlistInspect\|AllowlistItem" src/hooks/useAllowlists.ts` → both present.
- `grep -n "useMachineInspect\|MachineDetail" src/hooks/useMachines.ts` → both present.
- `grep -n "useBouncerInspect\|BouncerDetail" src/hooks/useBouncers.ts` → both present.
- `grep -n "encodeURIComponent" src/hooks/useAllowlists.ts src/hooks/useMachines.ts src/hooks/useBouncers.ts` → all three hooks encode the path param.
- Manual contract check (no backend change): `uv run python -m py_compile ../backend/routers/allowlists/inspect.py ../backend/routers/machines/inspect.py ../backend/routers/bouncers/inspect.py` → no syntax errors.

## Reviewer

- `crowdsec-documentation-reviewer` (contract alignment with plan §5.1–§5.3 + §4.2, no `any` regressions)

## Explicit out-of-scope

- Creating or modifying any `frontend/src/pages/**` file (tasks 02–04) or `frontend/src/components/**` (task-05 may touch shared components only if needed for a11y).
- Modifying `backend/**` (including `backend/routers/machines/inspect.py` datasource pop — note the mismatch for task-03 to handle, do not fix here).
- Adding mutations, new API routes, config keys (`config.yaml`, `backend/config.py`), Docker/K8s, DB, auth/session, or observability infra.
- Adding tests under `backend/tests/` — no pytest in this repo (board-wide rule; see README).
- Changing `frontend/src/lib/api/client.ts` or `frontend/src/lib/api/types.ts` beyond what this task specifies.

## Coordinator status

- Status: completed
- Completed by: kanban-task-coordinator (nextjs-dashboard agent)
- Completed at: 2026-08-17T00:00:00Z
- Verification: npm run typecheck green (zero errors); grep useAllowlistInspect/AllowlistItem, useMachineInspect/MachineDetail, useBouncerInspect/BouncerDetail present; encodeURIComponent in all 3 hooks; uv py_compile 3 routers green
- Commit or artifact reference: working tree (frontend/src/hooks/useAllowlists.ts, frontend/src/hooks/useMachines.ts, frontend/src/hooks/useBouncers.ts)
