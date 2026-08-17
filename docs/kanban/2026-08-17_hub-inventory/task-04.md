# Task 04 — Frontend hook + types for Hub

## Objective

Define the frontend data contract for the Hub domain in `frontend/src/lib/api/types.ts` (export `HUB_LIST = "hub.list"` and data interfaces `HubItem`, `HubInventory`), and implement the data-fetching hook `frontend/src/hooks/useHub.ts` via `apiGet` and TanStack Query `useQuery`.

## Prerequisites/dependencies

- task-01 COMPLETED — requires wire operation label `HUB_LIST = "hub.list"` to be established.
- Existing frontend API utilities: `frontend/src/lib/api/client.ts:apiGet` and `frontend/src/lib/api/types.ts`.
- Note: This task can run in parallel with task-02/task-03 as it touches only frontend files and builds against the specified API contract.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/lib/api/types.ts` — export `HUB_LIST = "hub.list"` constant; define `HubItem` and `HubInventory` types.
- **CREATE** `frontend/src/hooks/useHub.ts` — implement `useHub()` hook.

Do NOT touch `frontend/src/pages/Hub.tsx`, `App.tsx`, `router.tsx`, `Layout.tsx` (task-05), or any `backend/*` files (tasks 01–03).

## Concrete implementation steps

1. In `frontend/src/lib/api/types.ts`:
   - Add constant:
     ```ts
     export const HUB_LIST = "hub.list";
     ```
   - Add types:
     ```ts
     export interface HubItem {
       name: string;
       description?: string;
       version?: string;
       latest_version?: string;
       status?: string;
       tainted?: boolean;
       missing?: boolean;
       type?: string;
       [key: string]: unknown;
     }

     export type HubInventory = Record<string, HubItem[]>;
     ```
2. In `frontend/src/hooks/useHub.ts`:
   - Import `useQuery`, `UseQueryResult` from `@tanstack/react-query`.
   - Import `apiGet` from `@/lib/api/client` (or relative path `../lib/api/client`).
   - Import `HUB_LIST`, `HubInventory` from `@/lib/api/types`.
   - Implement:
     ```ts
     export interface UseHubOptions {
       enabled?: boolean;
       refetchInterval?: number | false;
     }

     export function useHub(options?: UseHubOptions): UseQueryResult<HubInventory, Error> {
       return useQuery<HubInventory, Error>({
         queryKey: ['hub'],
         queryFn: async () => {
           const response = await apiGet<HubInventory>('/hub');
           return response.result ?? ({} as HubInventory);
         },
         enabled: options?.enabled,
         refetchInterval: options?.refetchInterval,
       });
     }
     ```
   - Ensure defensive unwrapping and error propagation through standard `apiGet` client logic.

## Interfaces/contracts and integration points

- Consumes backend endpoint `GET /api/v1/hub`.
- `apiGet<HubInventory>('/hub')` unwraps the `{ operation: "hub.list", result: {...} }` envelope.
- `useHub()` returns standard TanStack Query result (`data`, `isLoading`, `isError`, `error`, `refetch`).
- `HUB_LIST` constant matches backend `backend/envelope.py:HUB_LIST`.

## Acceptance criteria

- `frontend/src/lib/api/types.ts` exports `HUB_LIST == "hub.list"`, `HubItem`, and `HubInventory`.
- `frontend/src/hooks/useHub.ts` exports `useHub` returning `UseQueryResult<HubInventory, Error>`.
- `useHub` uses `queryKey: ['hub']` and fetches from `/hub` using `apiGet`.
- TypeScript strict checks pass cleanly (`npm run typecheck` passes).
- No console errors or unresolved imports.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green (no type errors in `types.ts` or `useHub.ts`).
- `grep -n "HUB_LIST" src/lib/api/types.ts` → constant present.
- `grep -n "useHub" src/hooks/useHub.ts` → hook exported.

## Reviewer

- `crowdsec-documentation-reviewer` (contract alignment with plan §5.5)
- `nextjs-dashboard` secondary for TanStack Query options and type safety

## Explicit out-of-scope

- Building page component `Hub.tsx` (task-05).
- Modifying `Layout.tsx` or `App.tsx` (task-05).
- Any backend modifications (tasks 01–03).
- Adding custom axios/fetch wrappers — reuse `apiGet`.
- Adding mutations (e.g. install/upgrade collection hooks).

## Coordinator status
- Status: completed
- Completed by: nextjs-dashboard
- Completed at: 2026-08-17T00:00:00Z
- Verification: `npm run typecheck` passed cleanly with strict TypeScript checks.
- Commit or artifact reference: working tree
