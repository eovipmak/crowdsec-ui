# Task 04 — Decisions table v2 + trimmed filters (Origin/Scope removed, IP relabel)

## Objective
Verify that the decisions listing and search match the operator's
`cscli decisions list` format and remove the search filters the operator no
longer wants. Concretely: remove `Origin` and `Scope` from the decisions
filter UI; relabel "IP or range" to just "IP"; ensure the table columns
present the cscli `decisions list` form: ID, Source, Scope:Value, Reason,
Action, Country, AS, Events, expiration, Alert ID.

## Prerequisites/dependencies
Complete task 02 (backend contract — `origin` and `scope` filter fields
ignored server-side; new optional decision fields surfaced from the parsed
JSON if cscli returns them).

If task 02 is not landed, stop, report the blocker, and do not implement the
UI against an unverified contract — the new table columns depend on the
parsed shape (e.g. `events`, `alert_id`, `country`, `as`) task 02 publishes.
Do not guess field names.

Task 01 (metrics) and task 03 (alerts) are not prerequisites — the
decisions UI is independent of metrics and the alerts files.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 2. Depends on task 02. Can run in parallel with task 03 (alerts) and
task 05 (scenarios removal) because file ownership does not overlap: this
task only touches `frontend/src/app/(dashboard)/decisions/**` and its API
type mirror. Tasks 03 and 05 own different directories.

## Owner
Next.js dashboard agent.

## Files and artifacts
- `frontend/src/app/(dashboard)/decisions/_components/decisions-table.tsx`
  — update `COLUMNS` and per-row rendering to the cscli `decisions list`
  format.
- `frontend/src/app/(dashboard)/decisions/_components/decisions-filters.tsx`
  — remove Origin and Scope inputs; relabel "IP or range" to "IP".
- `frontend/src/app/(dashboard)/decisions/page.tsx` — re-check filter
  state plumbing only if needed (pure UI label/column change should not
  require logic edits).
- `frontend/src/lib/api/types.ts` — update
  `DecisionsListRequest["filter"]` to drop `origin?` and `scope?` (TypeScript
  contract mirror of task 02). Keep `ip?`, `type?`, `scenario?`. Mirror any
  new optional fields task 02 added to `DecisionItem` via the existing
  `[key: string]: unknown;` (no breaking change).
- `frontend/next.config.ts` / `package.json` — do NOT add new dependencies.
- Do NOT touch backend Go files; the API is consumed as-is from task 02.
- Do NOT touch `alerts/**` or `scenarios/**` (other tasks own them).

## Implementation steps
1. Update the decisions filter contract in `types.ts`: remove `origin` and
   `scope` from `DecisionsListRequest["filter"]`. Mirror any new fields task
   02 added to `DecisionItem` so the compiler stays happy.
2. In `decisions-filters.tsx`: remove the `Scope` and `Origin` `<Field>`
   blocks, their `useState` hooks, and the apply/clear reset lines. Relabel
   the "IP or range" `<Field label=...>` to "IP". Update the grid from
   `lg:grid-cols-3` to `lg:grid-cols-2` to reflect two fields (IP, Type,
   Scenario — actually three; review the final count and pick the columns
   layout to match the remaining fields). Remaining fields after the change:
   IP, Type, Scenario.
3. In `decisions-table.tsx`, align `COLUMNS` with the cscli `decisions list`
   header. The reference command shows:
   `ID | Source | Scope:Value | Reason | Action | Country | AS | Events | expiration | Alert ID`.
   Map to the existing `DecisionItem` fields surfaced by task 02:
   - `ID` ← `id`
   - `Source` ← `origin` (already on the existing type)
   - `Scope:Value` ← join of `scope` and `value` (e.g. `Ip:62.238.5.68`),
     with fallback to `value` when scope is empty.
   - `Reason` ← `scenario` is the existing mapping; if task 02 surfaced a
     distinct `reason` field use that instead. Otherwise `scenario` is the
     canonical reason field for decisions.
   - `Action` ← `type` (the existing field is the decision action, e.g.
     `ban`).
   - `Country` ← task 02 field if surfaced; otherwise `"—"`.
   - `AS` ← task 02 field if surfaced; otherwise `"—"`.
   - `Events` ← `events` (task 02 field if surfaced; e.g. `27`); otherwise
     `"—"`.
   - `expiration` ← `expiration`/`duration` — the existing column already
     falls back `until → duration`; preserve that fallback.
   - `Alert ID` ← `alert_id` (task 02 field if surfaced); otherwise `"—"`.
   Use `hiddenOnMobile` for the lower-priority columns to keep the table
   usable on small screens; preserve existing `render` per-cell fallbacks
   to `"—"`.
4. Verify nothing else in `decisions/page.tsx` depends on the removed
   fields — the existing filter state plumbing uses the filter object
   generically; once the form no longer emits `origin`/`scope`, the
   `applyFilters` `next` object simply won't include them.
5. Do not change the mutation forms (`decision-add-form.tsx`,
   `decision-delete-form.tsx`) — the IP-or-range behavior there is the
   matrix mutation contract (`decisions add --ip`, `decisions delete --ip`)
   and is intentionally scope-less. Do NOT relabel the mutation form's
   "IP or range" — the mutation truly accepts IP or CIDR range; only the
   list-filter label is being relabeled per the plan.
6. Do not add new polling, local stores, or new endpoints; the existing
   30s poll, `useApiResource`, and `decisions.list` read remain.
7. Do not break accessibility — every remaining input keeps its
   `htmlFor`/`id` pair; the form stays a `<form aria-label="Filter
   decisions">`.

## Contracts
- The decisions page still consumes only `decisions.list` (read) plus
  `decisions.add` / `decisions.delete` (mutations) from the matrix; no new
  endpoints.
- The filter request body matches the contract from task 02:
  `{ip?, type?, scenario?}` only; sending `origin`/`scope` is ignored
  server-side.
- The table renders only fields the backend exposes from task 02; absent
  fields fall back to `"—"`.
- The mutation forms are unchanged in their input semantics (IP or CIDR
  range); only the list-filter label changes to "IP".

## Acceptance criteria
- The decisions filter pane shows only IP (relabeled), Type, and Scenario.
  Origin and Scope are gone.
- The decisions table columns match the cscli `decisions list` reference
  header order where the backend exposes the fields; absent backend fields
  fall back to `"—"` (the table must not break when the host's cscli omits a
  column).
- The list-filter "IP or range" label now reads "IP"; the mutation forms'
  IP-or-range labels are unchanged (they accept CIDR ranges too).
- `npm run lint`, `npm run typecheck`, `npm run format:check`, and
  `npm run build` all pass.
- No new dependencies; no new API calls.

## Verification commands/checks
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run format:check`
- `cd frontend && npm run build`
- Manual: load `/decisions`, apply an IP filter, change Results-per-page,
  confirm columns mirror `cscli decisions list` shape, confirm Origin and
  Scope inputs are gone, confirm the IP filter label is "IP".
- Static search: confirm no `Scope`/`Origin` `<Field>` blocks remain in
  `decisions/_components/decisions-filters.tsx`; no new dependencies in
  `package.json`; mutation forms still say "IP or range" (they accept CIDR).

## Reviewer
Next.js dashboard developer and Backend Developer (contract conformance).

## Out of scope
- Backend contract changes (task 02 owns them).
- Alerts UI (task 03) and Scenarios UI removal (task 05).
- The decision mutation forms' IP-or-range semantics or labels.
- New shared Modal or DataTable dependencies.

## Coordinator status
- Status: not started
- Completed by: <agent name>
- Completed at: <timestamp>
- Verification: <summary of checks run>
- Commit or artifact reference: <commit SHA or file list>
