# Task 04 — Bouncer inspect dialog (`BouncerInspectDialog.tsx` + `Bouncers.tsx` wiring)

## Objective

Add a read-only inspection dialog for bouncers. Create `frontend/src/pages/BouncerInspectDialog.tsx` that fetches `GET /api/v1/bouncers/inspect/{name}` via `useBouncerInspect` and renders name, type, version, IP address, OS, auth_type, revoked, auto_created, created_at, updated_at, last_pull. Wire row-click / Inspect action in `frontend/src/pages/Bouncers.tsx` to open the dialog.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `frontend/src/hooks/useBouncers.ts:useBouncerInspect` and `BouncerDetail` type. If the hook is missing or path/queryKey differs, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/src/pages/BouncerInspectDialog.tsx` — modal dialog displaying bouncer metadata and poll status.
- **MODIFY** `frontend/src/pages/Bouncers.tsx` — add row-click / inspect button to open `BouncerInspectDialog`.

Do NOT touch `frontend/src/hooks/useBouncers.ts` (task-01), `frontend/src/hooks/useMachines.ts` (task-01), `frontend/src/hooks/useAllowlists.ts` (task-01), `frontend/src/pages/Allowlists.tsx` (task-02), `frontend/src/pages/Machines.tsx` / `MachineInspectDialog.tsx` (task-03), or any `backend/**` (read-only verification only).

## Concrete implementation steps

1. Read `frontend/src/hooks/useBouncers.ts` (post-task-01), `frontend/src/pages/AlertInspectDialog.tsx` (reference dialog), `frontend/src/components/ui/dialog.tsx`, `frontend/src/pages/Bouncers.tsx`, `frontend/src/components/LoadingSkeleton.tsx`, `frontend/src/components/ErrorPanel.tsx`, and `frontend/src/components/CapabilityBadge.tsx`.
2. Create `frontend/src/pages/BouncerInspectDialog.tsx` following the `AlertInspectDialog.tsx` pattern:
   - Props: `{ name: string | null; onClose: () => void }`. `open` is `name !== null`.
   - Hook: `const { data, isLoading, error, refetch } = useBouncerInspect(name);`.
   - Layout (inside `DialogContent max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden p-0`):
     - `DialogHeader` with `DialogTitle mono pr-8 text-sm` showing `Bouncer {name}` and `DialogDescription` like `Bouncer registration, version, and last pull activity.`.
     - Scroll container `max-h-[68vh] overflow-y-auto px-5 py-4`.
     - States: `isLoading && <LoadingSkeleton rows={4} />`, `error && <ErrorPanel error={error} onRetry={() => refetch()} />`.
     - On `data`:
       - Metadata grid (`grid grid-cols-1 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm sm:grid-cols-2`) with fields:
         - Name (`mono break-all`), Type (`mono text-xs`), Version (`mono break-words text-xs`), IP Address (`mono tabular break-all`), OS (`mono break-words`), Auth Type (`mono`), Revoked (`Badge variant="muted"|"outline"` — show `revoked` boolean), Auto Created (`Badge`), Created At / Updated At / Last Pull (`mono text-xs tabular break-words`).
       - Render `—` for missing optional fields (`ip_address`, `os`, `version`, etc.). Handle both `ip_address`/`ipAddress` defensively if needed, but primary contract is `ip_address` per plan §5.3.
       - Optional: if `last_pull` is stale, a muted hint `Last pull shows last LAPI poll time` — do not add staleness logic beyond display.
   - Close: `Dialog open={name !== null} onOpenChange={(open)=>{if(!open) onClose()}}` so Escape and overlay click close the dialog.
3. Modify `frontend/src/pages/Bouncers.tsx`:
   - Import `useState` and `BouncerInspectDialog`.
   - Add `const [selectedName, setSelectedName] = useState<string | null>(null);`.
   - Wire `DataTable onRowClick={(row) => setSelectedName(row.name)}` so clicking a row opens the dialog. Keep `rowKey={(row) => row.name}`.
   - Render `<BouncerInspectDialog name={selectedName} onClose={() => setSelectedName(null)} />` below the table.
   - Keep `CapabilityBadge op="bouncers.list"`, `LoadingSkeleton`, `ErrorPanel`, `EmptyState`, and column definitions unchanged except for adding `onRowClick` wiring.

## Interfaces/contracts and integration points

- Hook: `useBouncerInspect(name: string | null)` → `useQuery<BouncerDetail>` calling `apiGet<BouncerDetail>('/bouncers/inspect/${encodeURIComponent(name)}')`. Backend `GET /api/v1/bouncers/inspect/{name}` returns `{"operation":"bouncers.inspect","result":{name,type,ip_address,os,version,auth_type,revoked,auto_created,created_at,updated_at,last_pull}}` (plan §5.3). On failure, `apiGet` throws `ApiError` surfaced via `ErrorPanel`.
- `Dialog` contract: `@radix-ui/react-dialog` via `frontend/src/components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`. Reference `AlertInspectDialog.tsx:27-72`.
- `DataTable` contract: `data: T[]`, `columns: Column<T>[]`, `onRowClick`, `rowKey` — already keyboard-accessible via `role="button"` + `tabIndex=0` + Enter/Space handler.
- Styling tokens: match `AlertInspectDialog.tsx` and `Bouncers.tsx` — `border-[#232334]`, `bg-[#0f0f17]`, `mono`, `tabular`, `text-zinc-*`.

## Acceptance criteria

- `frontend/src/pages/BouncerInspectDialog.tsx` exists and exports default `BouncerInspectDialog`.
- `Bouncers` page rows are clickable (or have an Inspect button) and open the dialog with the correct `name`.
- Dialog shows name, type, exact version, IP, OS, auth_type, revoked/auto_created badges, created_at/updated_at, last_pull, with `—` for missing optional fields.
- Loading (`LoadingSkeleton`) and error (`ErrorPanel` with Retry) states work; `Escape` and overlay click close the dialog.
- `npm run typecheck` and `npm run build` pass.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` and `dist/assets/*` exist.
- `grep -n "BouncerInspectDialog\|useBouncerInspect" src/pages/Bouncers.tsx src/pages/BouncerInspectDialog.tsx` → wiring present.
- `grep -n "onRowClick" src/pages/Bouncers.tsx` → row-click wired.
- Manual walkthrough:
  ```bash
  npm run dev
  # Visit /bouncers:
  # - Table shows Name / Type / Version / IP Address / Last Pull.
  # - Click a row (or press Enter when focused) → dialog opens with bouncer name, type, exact version, OS, last pull.
  # - Press Escape → dialog closes; overlay click also closes.
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (a11y, read-only invariant, no backend mutation)
- `nextjs-dashboard` secondary for dialog + DataTable patterns

## Explicit out-of-scope

- Modifying `frontend/src/hooks/useBouncers.ts` (task-01 owns the hook/type).
- Modifying `backend/routers/bouncers/inspect.py` (verify only; note any serialization mismatch for a future follow-up, do not fix here).
- Creating `MachineInspectDialog.tsx` or modifying `Allowlists.tsx` / `Machines.tsx` (tasks 02–03).
- Any `backend/**` edits, new config keys, Docker/K8s, DB, auth/session, `backend/tests/` or pytest.
- Adding mutations (bouncers delete) — read-only invariant preserved.

## Coordinator status

- Status: completed
- Completed by: kanban-task-coordinator (nextjs-dashboard agent)
- Completed at: 2026-08-17T00:00:00Z
- Verification: npm run typecheck green (zero errors); npm run build green (1730 modules, dist/index.html + dist/assets/* exist); grep BouncerInspectDialog/useBouncerInspect/onRowClick present; dialog with defensive ip_address handling, Badge revoked/active, last_pull hint, Escape+overlay close
- Commit or artifact reference: working tree (frontend/src/pages/BouncerInspectDialog.tsx, frontend/src/pages/Bouncers.tsx)
