# Task 03 — Frontend hooks: `useAlerts` / `useDecisions` param extension

## Objective

Widen `frontend/src/hooks/useAlerts.ts` and `frontend/src/hooks/useDecisions.ts` to expose the new backend query params (`since`, `until`, `scenario_contains`, `offset`) through the existing `apiGet` envelope client, so pages (task-04) can drive time-range + substring + pagination without touching the backend.

## Prerequisites/dependencies

- Wave 1 — parallel with task-01 / task-02 (no file overlap). Requires `frontend/src/lib/api/client.ts:apiGet`, `frontend/src/lib/api/types.ts`, and existing `useAlerts.ts` / `useDecisions.ts` state. If those hooks or `apiGet` are missing/diverged, STOP and report blocker.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer` (type mirror, hook shape)

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/hooks/useAlerts.ts` — extend `useAlerts(opts)` and export `AlertsParams` type.
- **MODIFY** `frontend/src/hooks/useDecisions.ts` — extend `useDecisions(opts)` and export `DecisionsParams` type.
- Do NOT touch `backend/*` (tasks 01–02), `frontend/src/pages/*` or `frontend/src/components/FiltersBar.tsx` (task-04), or `docs/*` (task-05). Do not add new dependencies or new `lib/api` constants.

## Concrete implementation steps

1. `frontend/src/hooks/useAlerts.ts`:
   - Export `AlertsParams` type:
     ```ts
     export type AlertsParams = {
       limit?: number; scenario?: string; ip?: string;
       since?: string; until?: string; scenario_contains?: string; offset?: number;
     };
     ```
   - Change signature to `export function useAlerts(opts: AlertsParams)` (keep `Alert` interface unchanged — no schema change).
   - Inside `useQuery`, keep `queryKey: ['alerts', opts]` (so TanStack partitions cache by new fields) and `queryFn: () => apiGet<Alert[]>('/alerts', opts as Record<string,string|number>)`. No custom fetch logic — `apiGet` already serializes via `URLSearchParams` and unwraps envelope success/result vs throws `ApiError` on `operation_error`/`request_error`.
   - Keep `useAlert(id)` unchanged.

2. `frontend/src/hooks/useDecisions.ts`:
   - Export `DecisionsParams` similarly:
     ```ts
     export type DecisionsParams = {
       limit?: number; type?: string; ip?: string;
       since?: string; until?: string; scenario_contains?: string; offset?: number;
     };
     ```
   - Change `useDecisions(opts: DecisionsParams)` with same `queryKey: ['decisions', opts]` + `apiGet<Decision[]>('/decisions', opts as ...)`.

3. No change to `frontend/src/lib/api/client.ts` (already handles `params` via `URLSearchParams`) or `types.ts` (no new constant — `alerts.list` / `decisions.list` strings stay via backend envelope; optional `AlertsListParams` export not required if reviewer prefers minimal surface).

4. Keep `frontend/package.json` unchanged (no date-picker lib).

## Interfaces/contracts and integration points

- Backend routes (tasks 01–02): `GET /api/v1/alerts?…limit&scenario&ip&since&until&scenario_contains&offset` and `GET /api/v1/decisions?…` — hooks pass params verbatim.
- `apiGet(path, params)` maps `params` entries to `url.searchParams.set(k, String(v))`; undefined/null values already skipped via caller — pages should pass `since || undefined` etc. so empty filters are absent from query.
- TanStack Query: new fields automatically partition cache; no manual invalidation needed.
- Backward compat: callers with only `{limit, scenario, ip}` / `{limit, type, ip}` keep working (new fields optional).

## Acceptance criteria

- `useAlerts` and `useDecisions` export new `AlertsParams`/`DecisionsParams` types and accept `since`, `until`, `scenario_contains`, `offset` as optional fields.
- `queryKey` includes full `opts` (new fields participate in cache key).
- `apiGet` call still `'/alerts'` / `'/decisions'` with `opts as Record<…>` passthrough; no new fetch logic.
- `grep -n "scenario_contains\|since.*until\|offset" frontend/src/hooks/useAlerts.ts frontend/src/hooks/useDecisions.ts` shows fields in both hooks.
- `npm run typecheck` (from `frontend/`) passes zero errors; no backend files touched.

## Verification commands/checks

From `frontend/`:

- `grep -n "AlertsParams\|DecisionsParams" src/hooks/useAlerts.ts src/hooks/useDecisions.ts` → types present.
- `grep -n "scenario_contains" src/hooks/useAlerts.ts src/hooks/useDecisions.ts` → hook wiring present.
- `npm run typecheck` → green (zero errors).
- `npm run build` → green (dist exists) — optional at this stage but should not break build.

## Reviewer

- `crowdsec-documentation-reviewer` (type mirror, hook contract) — secondary `nextjs-dashboard` for ergonomics.

## Explicit out-of-scope

- `frontend/src/pages/Alerts.tsx`, `Decisions.tsx`, `frontend/src/components/FiltersBar.tsx` (task-04).
- `backend/*` (tasks 01–02) and `docs/*` (task-05).
- New `lib/api/types.ts` constants, new dependencies, new config keys, DB, Docker, Prometheus, mutations.

## Coordinator status

- Status: pending
