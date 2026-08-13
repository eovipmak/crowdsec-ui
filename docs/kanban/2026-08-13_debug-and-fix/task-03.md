# Task 03 — Alerts table v2 + alert-inspect modal + trimmed filters

## Objective
Bring the alerts UI in line with the operator's `cscli alerts list -m`
reference. The table must clearly show the scope/value (`Ip:<ip>`), reason,
country, AS, decisions, created_at, kind, and machine columns matching the
cscli `-m` view. Clicking an alert must open a modal with `alerts.inspect
ID` data and an `X` button to close it. The filters must drop Kind and
Scope (keep Scenario and IP only). The "Results per page" / limit control
must drive `cscli alerts list -l <n>`.

## Prerequisites/dependencies
Complete task 02 (backend contract — new parsed fields available, dropped
filter fields ignored on the server).

If task 02 is not landed, stop, report the blocker, and do not implement the
UI against an unverified contract — the new table columns depend on the
parsed shape (e.g. `country`, `as`, `machine`, `kind`, `reason`) that task
02 publishes. Do not guess field names.

If task 01 is not landed, the alerts UI changes are still valuable and
independent — alerts do not depend on metrics. Task 01 is not a
prerequisite.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 2. Depends on task 02. Can run in parallel with task 04 (decisions)
and task 05 (scenarios removal) because the file ownership does not overlap:
this task only touches `frontend/src/app/(dashboard)/alerts/**` and the
shared API types. Tasks 04 and 05 own different directories.

## Owner
Next.js dashboard agent.

## Files and artifacts
- `frontend/src/app/(dashboard)/alerts/_components/alerts-table.tsx` —
  update `COLUMNS` and per-row rendering to the v2 set.
- `frontend/src/app/(dashboard)/alerts/_components/alerts-filters.tsx` —
  remove Scope and Kind inputs; keep Scenario and IP.
- `frontend/src/app/(dashboard)/alerts/_components/alert-detail.tsx` —
  convert from the inline `Close` card to a modal dialog (overlay, `X`
  button, Escape-to-close) that renders `alerts.inspect` data.
- `frontend/src/app/(dashboard)/alerts/page.tsx` — wire the modal state;
  keep the existing poll/refresh, limit, and filter wiring.
- `frontend/src/lib/api/types.ts` — update `AlertsListRequest["filter"]` to
  drop `scope?` and `kind?` (TypeScript contract mirror of task 02). Keep
  `scenario?` and `ip?`. If task 02 surfaced new optional fields on
  `AlertItem`, mirror them here with `[key: string]: unknown;` already on
  the type (no breaking change).
- `frontend/next.config.ts` / `package.json` — do NOT add new dependencies.
  Reuse the existing `ConfirmationModal` overlay pattern in
  `frontend/src/components/shared/confirmation-modal.tsx` as the styling
  blueprint for the alert-inspect modal, OR build a small local modal
  (`role="dialog"`, `aria-modal="true"`, Escape handler, overlay click to
  close, `X` close button). No new UI library.
- Do NOT touch backend Go files; the API is consumed as-is from task 02.
- Do NOT touch `decisions/**` or `scenarios/**` (other tasks own them).

## Implementation steps
1. Update the alerts filter contract in `types.ts`: remove `scope` and
   `kind` from `AlertsListRequest["filter"]`. Mirror any new fields task 02
   added to `AlertItem` so the compiler stays happy.
2. In `alerts-filters.tsx`: remove the Scope and Kind `<Field>` blocks,
   their `useState` hooks, the apply/clear reset lines, and the `lg:grid-cols-4`
   → `lg:grid-cols-2` (or `sm:grid-cols-2`) grid layout to reflect two
   fields. Keep Scenario and IP. Keep the "Results per page" `<select>`
   driving the existing `onLimitChange` — this maps to `cscli alerts list
   -l <n>` server-side.
3. In `alerts-table.tsx`, change `COLUMNS` to render the cscli `-m` order:
   - `ID`
   - `value` — display as `scope:value` (e.g. `Ip:156.204.51.18`) when
     `scope` is present, otherwise fall back to `value`. The cscli `-m`
     table references `Ip:<ip>` so scope-join is the canonical form.
   - `reason` — render `reason`/`scenario` (whichever task 02 confirmed is
     in the JSON; the `-m` column header is `reason`).
   - `country` — task 02 field.
   - `as` — task 02 field (autonomous system; e.g. `8452 TE Data`).
   - `decisions` — already rendered as `type (duration)` join; keep.
   - `created_at` — task 02 field (or reuse `start_at` mapping if task 02
     confirmed they are the same).
   - `kind` — task 02 field (note: removed from FILTERS but KEPT in the
     table — the plan only removes Kind/Scope from search criteria).
   - `machine` — task 02 field.
   Use `hiddenOnMobile` judiciously so the row stays usable on small
   screens; preserve existing `render` per-cell fallbacks to `"—"`.
4. Convert `alert-detail.tsx` from a card with a "Close" button into a
   modal:
   - Add overlay (`fixed inset-0 z-50`, darkened backdrop) and a centered
     panel, matching the `ConfirmationModal` styling conventions.
   - Render the inspect fields as a `<dl>` (reuse the existing `DetailItem`
     helper), now including `country`, `as`, `machine`, `kind`, `reason`,
     `decisions` joined as before.
   - Add an explicit `X` button in the top-right corner of the modal
     header (the plan requires an `X` button to close), in addition to
     Escape and overlay-click handlers.
   - Preserve the existing loading / empty / error / unsupported states
     inside the modal body.
   - Keep `onClose` as the single exit signal used by both `X`, Escape,
     and overlay click (consistent with `ConfirmationModal`).
5. Wire the modal in `alerts/page.tsx`: the existing `selectedId` state
   remains; render `<AlertDetail>` as a modal when `selectedId != null`.
   Do not introduce a new route — keep the inline `View` button → modal
   open → `X`/overlay/Escape → close flow.
6. Do not add new polling or local stores; the 30s poll interval and
   `useApiResource` patterns stay.
7. Do not break accessibility: every modal must trap focus sufficiently
   that Escape closes it and the `X` button is keyboard-reachable; the
   `role="dialog" aria-modal="true"` attributes are mandatory.

## Contracts
- The alerts page still consumes only `alerts.list` (read) and
  `alerts.inspect` (read) from the matrix; no new endpoints, no
  mutations, no machine-side state beyond `selectedId`.
- The filter request body matches the contract from task 02:
  `{scenario?, ip?}` only; sending `scope`/`kind` is ignored server-side.
- The modal pattern mirrors `ConfirmationModal` (overlay + Escape +
  overlay-click + explicit button); no new dependencies.
- The table renders only fields the backend exposes from task 02; if a
  field is absent for a row, it falls back to `"—"` (no crash, no `null`
  render).

## Acceptance criteria
- The alerts table columns and order match the cscli `-m` reference:
  ID, value (scope:value), reason, country, as, decisions, created_at,
  kind, machine.
- The filters pane shows only Scenario and IP (plus the Results-per-page
  select). Scope and Kind are gone; the grid layout reflects two fields.
- Clicking `View` opens a modal with `alerts.inspect ID` data; an `X`
  button, Escape key, and overlay click all close the modal.
- The limit select drives the request body limit (which becomes
  `cscli alerts list -l <n>`).
- `npm run lint`, `npm run typecheck`, `npm run format:check`, and
  `npm run build` all pass.
- No new dependencies; no new API calls; no `decisions.inspect` call.

## Verification commands/checks
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run format:check`
- `cd frontend && npm run build`
- Manual: load `/alerts`, change the Results-per-page select, apply a
  Scenario filter, click `View` on a row → modal opens with inspect data
  including the new fields when cscli returns them; `X` closes the modal.
- Static search: confirm no Scope/Kind inputs remain in
  `alerts/_components/alerts-filters.tsx`; no new dependencies in
  `package.json`.

## Reviewer
Next.js dashboard developer and Backend Developer (contract conformance).

## Out of scope
- Backend contract changes (task 02 owns them).
- Decisions UI (task 04) and Scenarios UI removal (task 05).
- Metrics fix (task 01).
- New modal/headless-UI dependencies or a new shared Modal component
  (reuse `ConfirmationModal` styling pattern only).

## Coordinator status
- Status: not started
- Completed by: <agent name>
- Completed at: <timestamp>
- Verification: <summary of checks run>
- Commit or artifact reference: <commit SHA or file list>
