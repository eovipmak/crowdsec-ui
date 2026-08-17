# Task 03 — Machine inspect dialog (`MachineInspectDialog.tsx` + `Machines.tsx` wiring)

## Objective

Add a read-only inspection dialog for machines. Create `frontend/src/pages/MachineInspectDialog.tsx` that fetches `GET /api/v1/machines/inspect/{machine_id}` via `useMachineInspect` and renders machineId, IP, OS, version, isValidated/validated, auth_type, created_at/updated_at, last_heartbeat, last_push, and datasources when present. Wire row-click / Inspect action in `frontend/src/pages/Machines.tsx` to open the dialog.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `frontend/src/hooks/useMachines.ts:useMachineInspect` and `MachineDetail` type. If the hook is missing or has a different queryKey/path, STOP, report the blocker, do not guess.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **CREATE** `frontend/src/pages/MachineInspectDialog.tsx` — modal dialog displaying comprehensive machine metadata.
- **MODIFY** `frontend/src/pages/Machines.tsx` — add row-click / inspect button to open `MachineInspectDialog`.

Do NOT touch `frontend/src/hooks/useMachines.ts` (task-01), `frontend/src/hooks/useAllowlists.ts` (task-01), `frontend/src/hooks/useBouncers.ts` (task-01), `frontend/src/pages/Allowlists.tsx` (task-02), `frontend/src/pages/Bouncers.tsx` / `BouncerInspectDialog.tsx` (task-04), or any `backend/**` (read-only verification only).

## Concrete implementation steps

1. Read `frontend/src/hooks/useMachines.ts` (post-task-01), `frontend/src/pages/AlertInspectDialog.tsx` (reference dialog), `frontend/src/components/ui/dialog.tsx`, `frontend/src/components/DataTable.tsx`, `frontend/src/pages/Machines.tsx`, `frontend/src/components/LoadingSkeleton.tsx`, `frontend/src/components/ErrorPanel.tsx`, and `frontend/src/components/CapabilityBadge.tsx`.
2. Create `frontend/src/pages/MachineInspectDialog.tsx` following the `AlertInspectDialog.tsx` pattern:
   - Props: `{ machineId: string | null; onClose: () => void }`. `open` is `machineId !== null`.
   - Hook: `const { data, isLoading, error, refetch } = useMachineInspect(machineId);` — enabled guard in the hook means no fetch when `machineId` is null.
   - Layout (inside `DialogContent max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden p-0`):
     - `DialogHeader` with `DialogTitle mono pr-8 text-sm` showing `Machine {machineId}` and `DialogDescription` like `Registration, heartbeat, and datasource details.`.
     - Scroll container `max-h-[68vh] overflow-y-auto px-5 py-4`.
     - States: `isLoading && <LoadingSkeleton rows={4} />`, `error && <ErrorPanel error={error} onRetry={() => refetch()} />`.
     - On `data`:
       - Metadata grid (`grid grid-cols-1 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm sm:grid-cols-2`) with fields:
         - Machine ID (`mono break-all`), IP Address (`mono tabular break-all`), OS (`mono break-words`), Version (`mono break-words text-xs`), Auth Type (`mono`), Validated (`Badge variant="success"|"muted"`), Created At / Updated At / Last Heartbeat / Last Push (`mono text-xs tabular break-words`).
       - Handle both `machineId`/`machine_id` and `ipAddress`/`ip_address` and `isValidated`/`validated` key variants defensively (backend may return either casing; prefer `data.machineId ?? data.machine_id`). Render `—` for missing values.
       - Datasources section: if `data.datasources` is present and non-empty (object or array), render it. Current `backend/routers/machines/inspect.py` does `machine.pop("datasources", None)` before responding — so this section will typically be empty. Handle gracefully: if absent, render a muted note `No datasource details returned by this LAPI` rather than an empty table. If present as an object map or array, render a small `DataTable` or key-value list. Do NOT modify the backend to restore datasources in this task — keep the frontend defensive.
   - Close: `Dialog open={machineId !== null} onOpenChange={(open)=>{if(!open) onClose()}}` so Escape and overlay click close the dialog. Ensure `DialogContent` includes the close button from `dialog.tsx`.
3. Modify `frontend/src/pages/Machines.tsx`:
   - Import `useState` and `MachineInspectDialog`.
   - Add `const [selectedId, setSelectedId] = useState<string | null>(null);`.
   - Wire `DataTable onRowClick={(row) => setSelectedId(row.machine_id)}` so clicking a row opens the dialog. Alternatively, add an explicit `Inspect` column with a button — row-click is preferred because `DataTable` already supports `onRowClick` with keyboard (Enter/Space) and `role="button"` + `tabIndex=0` per row (see `DataTable.tsx:33-48`). Ensure `rowKey={(row) => row.machine_id}` remains.
   - Render `<MachineInspectDialog machineId={selectedId} onClose={() => setSelectedId(null)} />` below the table.
   - Keep `CapabilityBadge op="machines.list"`, `LoadingSkeleton`, `ErrorPanel`, `EmptyState`, and column definitions unchanged except for adding `onRowClick` wiring.

## Interfaces/contracts and integration points

- Hook: `useMachineInspect(machineId: string | null)` → `useQuery<MachineDetail>` calling `apiGet<MachineDetail>('/machines/inspect/${encodeURIComponent(machineId)}')`. Backend `GET /api/v1/machines/inspect/{machine_id}` returns `{"operation":"machines.inspect","result":{machineId/ipAddress/os/version/isValidated/auth_type/created_at/updated_at/last_heartbeat/last_push}}` (plan §5.2). On failure, `apiGet` throws `ApiError` surfaced via `ErrorPanel`.
- `Dialog` contract: `@radix-ui/react-dialog` via `frontend/src/components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`. Reference `AlertInspectDialog.tsx:27-72`.
- `DataTable` contract: `data: T[]`, `columns: Column<T>[]`, `onRowClick`, `rowKey`, `noHorizontalScroll` — already keyboard-accessible.
- Styling tokens: match `AlertInspectDialog.tsx` and `Machines.tsx` — `border-[#232334]`, `bg-[#0f0f17]`, `mono`, `tabular`, `text-zinc-*`.

## Acceptance criteria

- `frontend/src/pages/MachineInspectDialog.tsx` exists and exports default `MachineInspectDialog`.
- `Machines` page rows are clickable (or have an Inspect button) and open the dialog with the correct `machine_id`.
- Dialog shows machineId, IP, OS, version, validated badge, auth_type, created_at/updated_at, last_heartbeat, last_push, and handles missing `datasources` gracefully (muted note, not a crash or empty table).
- Loading (`LoadingSkeleton`) and error (`ErrorPanel` with Retry) states work; `Escape` and overlay click close the dialog; focus management follows Radix Dialog defaults.
- `npm run typecheck` and `npm run build` pass.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` and `dist/assets/*` exist.
- `grep -n "MachineInspectDialog\|useMachineInspect" src/pages/Machines.tsx src/pages/MachineInspectDialog.tsx` → wiring present.
- `grep -n "onRowClick" src/pages/Machines.tsx` → row-click wired.
- Manual walkthrough:
  ```bash
  npm run dev
  # Visit /machines:
  # - Table shows Machine ID / IP / Validated / Version / Last Heartbeat / Last Push.
  # - Click a row (or press Enter when focused) → dialog opens with machineId, OS, version, heartbeat, validated.
  # - Press Escape → dialog closes; overlay click also closes.
  # - With missing datasources (default), note "No datasource details" renders.
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (a11y, read-only invariant, no backend mutation)
- `nextjs-dashboard` secondary for dialog + DataTable patterns

## Explicit out-of-scope

- Modifying `frontend/src/hooks/useMachines.ts` (task-01 owns the hook/type).
- Modifying `backend/routers/machines/inspect.py` to restore `datasources`/`metrics` — handle absence in the UI only (note the backend pop for a future follow-up if needed; do not fix here).
- Creating `BouncerInspectDialog.tsx` or modifying `Allowlists.tsx` / `Bouncers.tsx` (tasks 02, 04).
- Any `backend/**` edits, new config keys, Docker/K8s, DB, auth/session, `backend/tests/` or pytest.
- Adding mutations (machines delete) — read-only invariant preserved.

## Coordinator status

- Status: completed
- Completed by: kanban-task-coordinator (nextjs-dashboard agent)
- Completed at: 2026-08-17T00:00:00Z
- Verification: npm run typecheck green (zero errors); npm run build green (1729 modules, dist/index.html + dist/assets/* exist); grep MachineInspectDialog/useMachineInspect/onRowClick present; dialog handles missing datasources with muted note, dual-key defensive, Escape+overlay close
- Commit or artifact reference: working tree (frontend/src/pages/MachineInspectDialog.tsx, frontend/src/pages/Machines.tsx)
