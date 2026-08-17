# Task 04 — Frontend hook + API types for metrics

## Objective

Extend the frontend API envelope types and provide a TanStack Query hook that fetches `GET /api/v1/metrics[/{component}]` via the existing `apiGet` client, matching the shape of `frontend/src/hooks/useAlerts.ts`.

## Prerequisites/dependencies

- task-01 COMPLETED — the wire label `metrics.show` / `"metrics.show"` must be stable (value consumed by hook types + page). If `backend/envelope.py:METRICS_SHOW` is missing, STOP and report the blocker; do not invent a different label.
- `frontend/src/lib/api/client.ts:apiGet`, `frontend/src/lib/api/types.ts`, `frontend/src/hooks/useAlerts.ts`, and `frontend/package.json` (Vite 6 + React 19 + TanStack Query v5) must be at current main state. If `apiGet` is absent or has different signature, STOP.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/lib/api/types.ts` — add `METRICS_SHOW = "metrics.show"` constant alongside existing error-code / envelope mirror (same string value as `backend/envelope.py:METRICS_SHOW`).
- **CREATE** `frontend/src/hooks/useMetrics.ts` — `useMetrics(component?: string)` hook + `MetricsPayload` type.

Do NOT touch `frontend/src/App.tsx` / `frontend/src/router.tsx` / `frontend/src/components/Layout.tsx` / `frontend/src/pages/Metrics.tsx` (task-05), `backend/` (tasks 01–03), or docs (task-06).

## Concrete implementation steps

1. `frontend/src/lib/api/types.ts` (currently mirrors `backend/errors.py` + envelope types):
   - Add `export const METRICS_SHOW = "metrics.show";` alongside the existing `INVALID_PARAMETERS` … `UNSUPPORTED` constants.
   - Keep `SuccessEnvelope<T>` / `OperationErrorEnvelope` / `RequestErrorEnvelope` types unchanged; string values must match `backend/errors.py` / `backend/envelope.py` exactly.
2. `frontend/src/hooks/useMetrics.ts`:
   - Follow `frontend/src/hooks/useAlerts.ts` exactly:
     ```ts
     import { useQuery } from '@tanstack/react-query';
     import { apiGet } from '@/lib/api/client';

     export type MetricsPayload = Record<string, unknown>;
     const METRICS_SHOW = 'metrics.show'; // or import from '@/lib/api/types'

     export function useMetrics(component?: string) {
       return useQuery<MetricsPayload>({
         queryKey: ['metrics', component ?? 'all'],
         queryFn: () => apiGet<MetricsPayload>(component ? `/metrics/${component}` : '/metrics'),
       });
     }
     ```
   - Alternative that reuses the operation label: import `METRICS_SHOW` from `@/lib/api/types` and include it in `queryKey` if desired — but keep the key stable.
   - `apiGet` already unwraps the envelope's `result` field on success and surfaces operation/request errors via the shared `errors.ts` path — do not re-parse envelopes here; delegate to `apiGet` like `useAlerts` does.
   - `MetricsPayload` is intentionally `Record<string, unknown>` — metrics shapes are heterogeneous per type (maps of maps, counters) and normalizing would be speculative (plan §7.2 / D5). Optionally export typed helpers for known shapes but keep the hook's return type generic.
   - If `component` is provided, it must be one of the 14 canonical types — but do NOT duplicate allowlist in the hook for runtime rejection; let the backend 400 surface as `OperationErrorEnvelope`/`RequestErrorEnvelope` handling. Frontend selector (task-05) restricts choices.

## Interfaces/contracts and integration points

- Wire contract (plan §5.1): `GET /api/v1/metrics` and `GET /api/v1/metrics/{component}` both use `operation: "metrics.show"`, `result: Record<string, unknown>` (parsed `cscli metrics show -o json` object). Responses are `Cache-Control: no-store`; hook does not need to manage cache headers.
- Error codes: `invalid_parameters` (400 on bad component/unknown query key), `unsupported` (HTTP 200 operation_error when probe failed), `crowdsec_failure`/`timeout`/`unavailable`/`permission_denied`/`malformed_output` (HTTP 200). All surface via `apiGet` → TanStack Query error state — `ErrorPanel` / `CapabilityBadge` consume them in task-05.
- `useMetrics` depends on `apiGet` path prefix handling (client already prepends `/api/v1`).

## Acceptance criteria

- `frontend/src/lib/api/types.ts` exports `METRICS_SHOW === "metrics.show"` and existing error-code constants still mirror `backend/errors.py`.
- `frontend/src/hooks/useMetrics.ts` exports `MetricsPayload` and `useMetrics(component?: string)` using `apiGet<MetricsPayload>(...)` and TanStack Query `useQuery`, patterned on `useAlerts`.
- No duplicated allowlist, no Prometheus code, no new config.
- `npm run typecheck` (from `frontend/`) green.
- Importing `useMetrics` in a throwaway component does not introduce a circular dependency or leak `client.ts` internals.

## Verification commands/checks

From `frontend/`:

- `npm install`
- `grep -n "METRICS_SHOW" src/lib/api/types.ts src/hooks/useMetrics.ts` → both files reference the label.
- `grep -n "apiGet.*metrics\|useMetrics" src/hooks/useMetrics.ts` → hook uses `apiGet`.
- `grep -n "Record<string, unknown>\|MetricsPayload" src/hooks/useMetrics.ts` → generic payload type present.
- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` and `dist/assets/*.js` exist (no need to serve yet — routing/page wiring is task-05).

## Reviewer

- `crowdsec-documentation-reviewer` (wire contract coherence between backend envelope and frontend types)

## Explicit out-of-scope

- Creating `frontend/src/pages/Metrics.tsx` or touching nav/routing (`App.tsx`, `router.tsx`, `Layout.tsx`) — task-05.
- Modifying any `backend/` file — tasks 01–03.
- Modifying `frontend/src/lib/api/client.ts` or `frontend/src/lib/api/errors.ts` — reuse existing behavior.
- Adding Prometheus `/metrics` text exposition or Grafana artifacts.
- New config keys, auth/session, Docker/K8s, DB.

## Coordinator status
- Status: completed
- Completed by: muse-spark-1.2-contributor
- Completed at: 2026-08-17T09:35:56Z
- Verification summary: grep METRICS_SHOW hits both src/lib/api/types.ts:20 and src/hooks/useMetrics.ts:3/8; grep apiGet.*metrics / useMetrics hits queryFn line; grep MetricsPayload hits Record<string, unknown> type; npm run typecheck green (tsc --noEmit); npm run build green (vite 6.4.3, 1723 modules, dist/index.html + dist/assets/index-BLMjVuwa.js exist); no allowlist duplication; no Prometheus; no circular import; apiGet signature verified (export async function apiGet<T>(path, params?)); backend/envelope.py METRICS_SHOW="metrics.show" stable
- Commit reference: working tree (frontend/src/lib/api/types.ts, frontend/src/hooks/useMetrics.ts)
