# Task 10 — Frontend pages: 6 read-only dashboard pages + TanStack Query hooks

## Objective

Implement the 6 read-only dashboard pages per plan §7.1 using the scaffold established in task-09: Overview, Alerts, Decisions, Machines, Bouncers, Allowlists. Each page: TanStack `useQuery` calling the shared `apiGet<T>`, 30s polling (set in task-09's `QueryClient` defaults; not overridden here), loading skeleton, error panel with retry, empty state, `CapabilityBadge` consults `/capabilities` and disables the section when `supported: false`. NO login, NO mutations, NO CSRF.

## Prerequisites/dependencies

- task-09 COMPLETED (Vite scaffold + API client + skeleton components).
- (Optional, for live data during page-dev) task-04 + tasks 05/06/07 backend landed — so `vite dev` proxy hits a real API. Not strictly required — pages can be developed against empty-state + mocked fixtures during dev; final acceptance uses `npm run build`.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard` (Vite/React stack — not Next.js per plan §7).
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/src/hooks/useCapabilities.ts`, `useAlerts.ts`, `useDecision.ts.tsx` (named `useDecisions.ts`), `useMachines.ts`, `useBouncers.ts`, `useAllowlists.ts`, `useStatus.ts`.
- **CREATE** `frontend/src/pages/Overview.tsx`, `Alerts.tsx`, `Decisions.tsx`, `Machines.tsx`, `Bouncers.tsx`, `Allowlists.tsx`.
- **CREATE** `frontend/src/pages/AlertInspectDialog.tsx` (alert detail dialog opened from Alerts row click).
- **MODIFY** `frontend/src/App.tsx` — wire the 6 page routes + the `/unknown` not-found view + ensure `Navigate to="/overview" replace` for root `/`.
- **MODIFY/IMPLEMENT** `frontend/src/components/{DataTable,FiltersBar,ErrorPanel,EmptyState,CapabilityBadge,LoadingSkeleton}.tsx` — full implementation (task-09 produced skeletons).

Do NOT touch `backend/` or `frontend/src/components/ui/*` (shadcn primitives) or `frontend/src/lib/api/*` (task-09 owns the API client; if types drift, update via a new request to task-09, NOT here).

## Concrete implementation steps

1. TanStack hooks (`frontend/src/hooks/`):
   ```ts
   // useCapabilities.ts
   import { useQuery } from '@tanstack/react-query';
   import { apiGet } from '@/lib/api/client';
   export type OpCap = { supported: boolean };
   export type Capabilities = Record<string, OpCap>;
   export function useCapabilities() {
     return useQuery<Capabilities>({
       queryKey: ['capabilities'],
       queryFn: () => apiGet<Capabilities>('/capabilities'),
     });
   }
   // useAlerts.ts
   export type Alert = { id: number; scenario: string; message: string; source_ip?: string;
     country?: string; as_name?: string; events_count?: number; created_at?: string;
     log_type?: string; service?: string; machine?: string; decisions?: { type: string; duration: string }[] };
   export function useAlerts(opts: { limit?: number; scenario?: string; ip?: string }) {
     return useQuery<Alert[]>({
       queryKey: ['alerts', opts],
       queryFn: () => apiGet<Alert[]>('/alerts', opts as any),
     });
   }
   export function useAlert(id: number | null) {
     return useQuery<Alert & { events?: any[] }>({
       enabled: id !== null,
       queryKey: ['alert', id],
       queryFn: () => apiGet(`/alerts/inspect/${id}`),
     });
   }
   // useDecisions.ts (first-decision-per-alert shape)
   export type Decision = { id: number; scenario: string; message?: string; created_at?: string;
     source_ip?: string; country?: string; as_name?: string; type: string; value: string;
     scope?: string; duration?: string; origin?: string; simulated?: boolean };
   export function useDecisions(opts: { limit?: number; type?: string; ip?: string }) {
     return useQuery<Decision[]>({
       queryKey: ['decisions', opts],
       queryFn: () => apiGet<Decision[]>('/decisions', opts as any),
     });
   }
   // useMachines.ts, useBouncers.ts, useAllowlists.ts — analogous.
   // useStatus.ts:
   export function useStatusLapi() {
     return useQuery<boolean>({ queryKey: ['status','lapi'], queryFn: async () => (await apiGet<{healthy: boolean}>('/status/lapi')).healthy });
   }
   export function useStatusCapi() { /* mirror for capi'/enabled */ }
   ```
2. `_components/CapabilityBadge.tsx` — props `op: string`, renders a small green "Supported" or red "Unsupported — cscli probe failed" badge based on `useCapabilities()[op]?.supported`; call sites use it to gate the section.
3. `_components/{DataTable,FiltersBar,ErrorPanel,EmptyState,LoadingSkeleton}.tsx`:
   - `DataTable<T>` generic with columns config: `{ key: keyof T & string; header: string; render?: (row: T) => ReactNode }[]`.
   - `FiltersBar` props: section-specific filter inputs + limit picker 25/50/100.
   - `ErrorPanel` props: `error: ApiError | Error`, `onRetry: () => void` — shows `messageFor(error.code)` or fallback, Retry button.
   - `EmptyState` props: `title: string`, `description?: string`.
   - `LoadingSkeleton` props: `rows: number`.
4. Per-page wiring — the pattern repeats:
   ```tsx
   // Alerts.tsx
   export default function Alerts() {
     const [filters, setFilters] = useState({ limit: 50, scenario: '', ip: '' });
     const { data, isLoading, error, refetch } = useAlerts({ limit: filters.limit, scenario: filters.scenario || undefined, ip: filters.ip || undefined });
     const caps = useCapabilities();
     if (caps.data?.['alerts.list']?.supported === false) return <CapabilityBadge op="alerts.list" />;
     if (isLoading) return <LoadingSkeleton rows={5} />;
     if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;
     if (!data || data.length === 0) return <EmptyState title="No alerts" description="..." />;
     const columns = [/* id, source_ip, scenario, country, as_name, decisions, created_at */];
     return (
       <div>
         <FiltersBar ... />
         <DataTable data={data} columns={columns} onRowClick={(r) => setInspecting(r.id)} />
         <AlertInspectDialog id={inspecting} onClose={() => setInspecting(null)} />
       </div>
     );
   }
   ```
5. **AlertInspectDialog** — on row click, opens the shadcn `Dialog` and invokes `useAlert(id)`; renders the flat alert's fields + the events list.
6. **Overview page** — pulls counts from `useAlerts`, `useDecisions`, `useMachines` (`.length`), `useStatusLapi`, `useStatusCapi`; renders the status cards (active alerts count, active decisions count, registered machines count, LAPI/CAPI health badges). Polls at 30s (default-only).
7. **Decisions page** — DataTable (no add/delete controls; plan D6). `FiltersBar` with scenario/ip/type + limit picker.
8. **Machines page** — DataTable (machineId, ip, validated, last_heartbeat).
9. **Bouncers page** — DataTable (name, type, version, ip, last_pull; no delete control).
10. **Allowlists page** — cards per allowlist from `useAllowlists` (each shows `{name, description, created_at, updated_at, size}` and an entries table — entries are passed-through from the cscli payload; console-managed → read-only). A "Check IP" card with an input + button that calls `apiGet<{matched: boolean}>(`/allowlists/check/${encodeURIComponent(ip).replace(/%2F/g, '/')}`)` — NOTE: for CIDR inputs containing `/`, the SPA MUST percent-encode `/` as `%2F` (plan D14 + task-07 §7.7 note). Show "Matched" / "Not matched".
11. **App.tsx** — wire routes:
    ```tsx
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/decisions" element={<Decisions />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/bouncers" element={<Bouncers />} />
        <Route path="/allowlists" element={<Allowlists />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    ```
12. `NotFound.tsx`: small centered "Page not found" + link back to `/overview`.

## Interfaces/contracts and integration points

- Every page consumes `useCapabilities` to gate the section via `CapabilityBadge`.
- The `/allowlists/check/{ip}` URL MUST encode `/` as `%2F` for CIDR inputs; document inline in the `Allowlists.tsx` Check IP card.
- The `Alert`/`Decision` field shapes MUST mirror the backend's flattened outputs byte-for-byte (task-06 alerts; task-07 decisions). If the field name diverges, the page TS type must match (verify against `backend/routers/.../*.py`).
- All routes are public (no auth guard) per plan D5.

## Acceptance criteria

- `npm run typecheck` green (strict TS).
- `npm run build` green; the build emits 6 page chunks (Vite splits per route lazy-loaded via `React.lazy` is optional — Vite routes default to one bundle; either is fine).
- Browser walkthrough with `vite dev` against running `uvicorn`: every page renders a loading skeleton → either data or empty/error state; no console errors.
- Clicking an Alerts row opens the inspect dialog and shows the alert fields + events.
- Capability gating works: when `/capabilities` returns an op's `supported: false`, the corresponding section shows the `CapabilityBadge` only (no data fetch).
- Allowlists "Check IP" path-test: enter `1.2.3.4` → request goes to `/api/v1/allowlists/check/1.2.3.4` (visible in DevTools Network); enter `1.2.3.0/24` → request URL contains `%2F`.

## Verification commands/checks

From `frontend/`:
- `npm run typecheck` → green.
- `npm run build` → green; `ls dist/` shows `index.html` + hashed assets.
- `grep -rn 'useMutation' src/` → no matches (no mutations).
- `grep -rn 'X-CSRF-Token\|useAuth\|RequireAuth' src/` → no matches (no auth surface).
- Manual browser walkthrough: `npm run dev`, walk the 6 routes, confirm rendering.
- After backend landed: open `/overview`, see status card counts refreshing every 30s.

## Explicit out-of-scope

- Backend code or routers (tasks 02–08).
- Authentication / login / auth guard / CSRF / sessions (dropped; plan D5).
- Mutations + ConfirmDialog (dropped; plan D6).
- Dark mode / theme toggle (optional).
- Tests / vitest (D12).
- Editing the source plan.

## Coordinator status
- Status: pending
- Completed by: —
- Completed at: —
- Verification: —
- Commit or artifact reference: —
