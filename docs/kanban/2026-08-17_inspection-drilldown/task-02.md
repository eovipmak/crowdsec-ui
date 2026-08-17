# Task 02 — Allowlist entries drill-down in `Allowlists.tsx`

## Objective

Enhance `frontend/src/pages/Allowlists.tsx` to expose the allowlist items that the backend already returns. Users can open an allowlist (e.g. `vnh_ip`) and see its entries in a table with columns Value (IP/CIDR) | Description | Created At | Expiration, plus an empty state when `items` is empty. Preserve the existing card summary, CapabilityBadge, IP check card, and empty/no-data states.

## Prerequisites/dependencies

- task-01 COMPLETED — requires `frontend/src/hooks/useAllowlists.ts:useAllowlistInspect` and `AllowlistItem`/`AllowlistDetail` types. If the hook is missing or has a different signature (e.g. missing `encodeURIComponent` or `enabled` guard), STOP, report the blocker, do not guess or reimplement the hook here.

## Owner / recommended agent profile

- Implementer: `nextjs-dashboard`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `frontend/src/pages/Allowlists.tsx` — add entries drill-down view (expandable section, drawer, or inline table) wired to `useAllowlistInspect`.

Do NOT touch `frontend/src/hooks/useAllowlists.ts` (task-01), `frontend/src/pages/Machines.tsx` (task-03), `frontend/src/pages/Bouncers.tsx` (task-04), `frontend/src/pages/MachineInspectDialog.tsx` / `BouncerInspectDialog.tsx` (tasks 03–04), or any `backend/**` (read-only verification only).

## Concrete implementation steps

1. Read `frontend/src/pages/Allowlists.tsx`, `frontend/src/hooks/useAllowlists.ts` (post-task-01), `frontend/src/components/DataTable.tsx`, `frontend/src/components/ui/dialog.tsx`, `frontend/src/components/LoadingSkeleton.tsx`, `frontend/src/components/ErrorPanel.tsx`, `frontend/src/components/EmptyState.tsx`, and `frontend/src/pages/AlertInspectDialog.tsx` (reference for dialog + DataTable pattern).
2. In `frontend/src/pages/Allowlists.tsx`:
   - Import `useAllowlistInspect` and `AllowlistItem` from `@/hooks/useAllowlists`; import `DataTable` and `Column`.
   - Add local state: `const [selectedName, setSelectedName] = useState<string | null>(null)`.
   - Call `const inspect = useAllowlistInspect(selectedName)` — hook is disabled when `selectedName` is `null` (enabled guard from task-01).
   - On each allowlist `Card`, add an affordance to open entries. Preferred: a `View entries (N)` button in `CardHeader` beside the size badge, or make the whole card clickable with `role="button"` + keyboard handler. Must be keyboard-accessible (`onKeyDown` for Enter/Space, `tabIndex=0`) and have an `aria-label` like `View entries for ${al.name}`. Do NOT introduce a new route — this is an inline expansion or dialog on the same `/allowlists` page.
   - Render entries when open. Two acceptable patterns (pick one and keep it simple):
     - **Inline expansion:** when `selectedName === al.name`, render a bordered section under the card with the entries table.
     - **Dialog:** reuse `Dialog` from `@/components/ui/dialog` with `open={selectedName !== null}` and `onOpenChange` closing to `setSelectedName(null)`. Title is the allowlist name.
   - Inside the expanded/dialog content:
     - Loading: `<LoadingSkeleton rows={3} />` while `inspect.isLoading`.
     - Error: `<ErrorPanel error={inspect.error} onRetry={() => inspect.refetch()} />` — surfaces `ApiError.code`/`message` without raw stderr.
     - Success with items: `DataTable` with columns:
       ```ts
       const itemColumns: Column<AllowlistItem>[] = [
         { key: 'value', header: 'Value', className: 'mono tabular break-all' },
         { key: 'description', header: 'Description', className: 'break-words text-xs' },
         { key: 'created_at', header: 'Created At', className: 'mono text-xs tabular whitespace-nowrap' },
         { key: 'expiration', header: 'Expiration', className: 'mono text-xs tabular whitespace-nowrap', render: (row) => isNeverExpire(row.expiration) ? '— never' : row.expiration },
       ];
       ```
       Treat `expiration === "0001-01-01T00:00:00.000Z"` or empty as "never expires" (render `—` or `Never`). Keep rendering defensive: if `items` is missing or not an array, treat as empty.
     - Success with no items: render an inline empty message `No entries in this allowlist` (use `EmptyState` or a simple muted paragraph) — matches plan §7.1 acceptance.
     - Header should also show allowlist-level metadata when drilled down: `description`, `created_at`, `updated_at` (already on the card; optionally repeat in the detail header).
   - Close behavior: button or `Escape` closes the dialog/expansion. If using Dialog, Radix handles Escape and overlay click. If inline, provide a `Close`/`Hide entries` button and ensure focus returns to the trigger.
3. Keep existing `useAllowlists()` list, `useAllowlistCheck` IP check card, `CapabilityBadge op="allowlists.list"`, and the `No allowlists` empty state unchanged.

## Interfaces/contracts and integration points

- Hook: `useAllowlistInspect(name: string | null)` → `useQuery<AllowlistDetail>` calling `apiGet<AllowlistDetail>('/allowlists/inspect/${encodeURIComponent(name)}')`. Backend endpoint `GET /api/v1/allowlists/inspect/{name}` returns `{"operation":"allowlists.inspect","result":{"name","description","created_at","updated_at","items":[{"value","description","created_at","expiration"}]}}` (plan §5.1). On `operation_error` with `crowdsec_failure` (not found), show `ErrorPanel`.
- `DataTable` props: `data: AllowlistItem[]`, `columns: Column<AllowlistItem>[]`, optional `rowKey={(row) => row.value}`.
- `Dialog` pattern: reference `AlertInspectDialog.tsx` — `Dialog open={...} onOpenChange={(open)=>{if(!open) onClose()}}` + `DialogContent` + `DialogHeader`/`DialogTitle`/`DialogDescription`.
- Styling tokens: `bg-[#09090f]`, `border-[#232334]`, `text-zinc-*`, `mono` for IP/CIDR and timestamps, as used in `Allowlists.tsx` and `Hub.tsx`.

## Acceptance criteria

- Navigating to `/allowlists` still shows the summary cards and IP check. Clicking `View entries` (or the card) for an allowlist triggers `GET /api/v1/allowlists/inspect/{name}` and renders a table with columns Value | Description | Created At | Expiration.
- Empty allowlists render `No entries in this allowlist` instead of an empty table.
- `expiration` sentinel `0001-01-01T00:00:00.000Z` renders as `—` / `Never`, not the raw sentinel.
- Loading and error states are handled (`LoadingSkeleton` + `ErrorPanel` with Retry).
- Keyboard: trigger is focusable and activatable via Enter/Space; dialog (if used) closes on `Escape` and overlay click; inline expansion has a close affordance.
- No new route is added; no mutation UI; `npm run typecheck` passes.

## Verification commands/checks

From `frontend/`:

- `npm run typecheck` → green.
- `npm run build` → green; `dist/index.html` and `dist/assets/*` exist.
- `grep -n "useAllowlistInspect" src/pages/Allowlists.tsx` → hook consumed.
- `grep -n "DataTable\|view.*entries\|View entries" src/pages/Allowlists.tsx` → drill-down UI present.
- Manual walkthrough with dev server:
  ```bash
  npm run dev
  # Visit /allowlists:
  # - Cards show name + size badge + description.
  # - Click "View entries" on vnh_ip → entries table with Value/Description/Created At/Expiration appears.
  # - Verify empty allowlist shows "No entries in this allowlist".
  # - Verify keyboard: Tab to trigger, Enter opens, Escape closes (if dialog).
  ```
- Backend smoke (from `backend/`, no code change):
  ```bash
  DASHBOARD_CONFIG=../config.yaml uv run uvicorn main:app --host 127.0.0.1 --port 8090 &
  curl -s http://127.0.0.1:8090/api/v1/allowlists/inspect/vnh_ip | python3 -m json.tool | head -n 40
  ```

## Reviewer

- `crowdsec-documentation-reviewer` (read-only invariant, no mutation UI, consistent tokens)
- `nextjs-dashboard` secondary for DataTable + Dialog patterns

## Explicit out-of-scope

- Modifying `frontend/src/hooks/useAllowlists.ts` (task-01 owns the hook).
- Creating `MachineInspectDialog.tsx` / `BouncerInspectDialog.tsx` (tasks 03–04).
- Any `backend/**` edits (including `backend/routers/allowlists/inspect.py` — verify only).
- Mutations (`allowlists add/delete`, decisions delete), new config keys, Docker/K8s, DB, auth/session, observability infra.
- Adding `backend/tests/` or pytest — board-wide rule: no pytest, verification is `typecheck` + `build` + manual walkthrough.

## Coordinator status

- Status: completed
- Completed by: kanban-task-coordinator (nextjs-dashboard agent)
- Completed at: 2026-08-17T00:00:00Z
- Verification: npm run typecheck green (zero errors); npm run build green (1729 modules, dist/index.html + dist/assets/* exist); grep useAllowlistInspect/DataTable/View entries present; dialog with sentinel expiration handling, defensive items array, LoadingSkeleton/ErrorPanel, no new route
- Commit or artifact reference: working tree (frontend/src/pages/Allowlists.tsx)
