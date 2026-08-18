# Task 04 — Frontend hook + types for `simulation.status`

## Objective

Add the frontend wire for simulation: the `SIMULATION_STATUS` constant, `SimulationResult` type, and `useSimulation()` TanStack Query hook that calls `GET /api/v1/simulation` via the existing `apiGet` envelope client. No page or banner yet — just the hook and types so task-05 can consume them.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `backend/envelope.py:SIMULATION_STATUS` label exists (so frontend constant mirrors backend). If envelope label is missing, STOP, report blocker.
- Existing frontend patterns: `frontend/src/lib/api/client.ts:apiGet`, `frontend/src/lib/api/types.ts` constants, `frontend/src/hooks/useMachines.ts` / `useBouncers.ts` / `useAllowlists.ts` as hook templates. `frontend/package.json` already has `@tanstack/react-query`.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/lib/api/types.ts` — add `export const SIMULATION_STATUS = "simulation.status"` alongside `HUB_LIST` / `METRICS_SHOW`; keep `HubItem`/`HubInventory` and error-code constants unchanged; no new error code.
- **CREATE** `frontend/src/hooks/useSimulation.ts` — `useSimulation()` hook + `SimulationResult` type.

Do NOT touch `backend/*` (tasks 01–03), `frontend/src/pages/*` (task-05), `frontend/src/components/Layout.tsx` beyond types, or `docs/*` (task-06).

## Concrete implementation steps

1. `frontend/src/lib/api/types.ts`:
   - Add after `export const HUB_LIST = "hub.list";`:
     ```ts
     export const SIMULATION_STATUS = "simulation.status";
     export type SimulationResult = { global: boolean; scenarios: string[]; raw: string };
     ```
   - Keep `SuccessEnvelope` / `OperationErrorEnvelope` / `RequestErrorEnvelope` and error-code constants (`INVALID_PARAMETERS` etc.) unchanged.

2. `frontend/src/hooks/useSimulation.ts`:
   - Follow `useMachines.ts` / `useBouncers.ts` pattern:
     ```ts
     import { useQuery } from '@tanstack/react-query';
     import { apiGet } from '@/lib/api/client';
     import type { SimulationResult } from '@/lib/api/types';

     export type { SimulationResult } from '@/lib/api/types';

     export function useSimulation() {
       return useQuery<SimulationResult>({
         queryKey: ['simulation'],
         queryFn: () => apiGet<SimulationResult>('/simulation'),
       });
     }
     ```
   - Use `apiGet` which already unwraps the envelope (`success` → `result`, `operation_error` → throws with `error.code`). No custom fetch logic.
   - Do NOT add polling, refetchInterval, or capability gating here — task-05 decides UI refresh policy. Keep hook minimal like `useMachines`/`useBouncers`.

## Interfaces/contracts and integration points

- Backend route: `GET /api/v1/simulation` → `apiGet("/simulation")` (client strips `/api/v1` prefix per `frontend/src/lib/api/client.ts`).
- Wire types: `SimulationResult` mirrors backend `{"global": bool, "scenarios": string[], "raw": string}`. Must match `backend/routers/simulation/status.py:parse_simulation_output` return shape.
- Constants: `SIMULATION_STATUS` string value must be `"simulation.status"` exactly — mirrors `backend/envelope.py:SIMULATION_STATUS`.
- Error handling: operation-level errors (`unsupported`, `crowdsec_failure`, `timeout`, etc.) surface as thrown errors via `apiGet`; request-level 400 (`invalid_parameters`) is not expected for this hook (no params), but would also throw.

## Acceptance criteria

- `frontend/src/lib/api/types.ts` exports `SIMULATION_STATUS === "simulation.status"` and `SimulationResult` type.
- `frontend/src/hooks/useSimulation.ts` exists, exports `useSimulation()` with `queryKey: ['simulation']` and `queryFn: () => apiGet<SimulationResult>('/simulation')`.
- `grep -n "SIMULATION_STATUS" frontend/src/lib/api/types.ts frontend/src/hooks/useSimulation.ts` shows the constant in both files.
- `npm run typecheck` (from `frontend/`) passes with zero errors.
- No new dependency, no new config, no backend file touched.

## Verification commands/checks

From `frontend/`:

- `grep -n "SIMULATION_STATUS" src/lib/api/types.ts src/hooks/useSimulation.ts` → constant present.
- `grep -n "useSimulation" src/hooks/useSimulation.ts` → hook present.
- `npm run typecheck` → green (zero errors).
- `npm run build` → green; `dist/index.html` exists (optional at this stage — task-05 also checks build, but this task should not break build).

## Reviewer

- `crowdsec-documentation-reviewer` (type mirror, wire contract, hook shape)
- Secondary: `nextjs-dashboard` for hook ergonomics.

## Explicit out-of-scope

- Modifying any `frontend/src/pages/*` (task-05 does Overview/Decisions banners).
- Modifying `frontend/src/components/Layout.tsx` or nav — simulation is banner-only, no nav item.
- Adding polling, refetchInterval, capability badge, or raw `<pre>` rendering — task-05 handles UI.
- Backend files (`backend/envelope.py`, `backend/capabilities.py`, `backend/routers/simulation/*`, `backend/main.py`) — tasks 01–03.
- Docs (`docs/architecture.md`, `docs/operations-reference.md`) — task-06.

## Coordinator status
- Status: completed
- Completed by: nextjs-dashboard
- Completed at: 2026-08-18T00:00:00Z
- Verification: grep SIMULATION_STATUS in types.ts, useSimulation exported from hook, npm run typecheck green (zero errors), npm run build green (dist/index.html produced), no new deps, no backend touched
- Commit or artifact reference: working tree

