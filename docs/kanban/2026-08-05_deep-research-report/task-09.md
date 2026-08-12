# Task 09 — Implement alerts and decisions workflows

## Objective
Implement searchable, filterable, paginated alert and decision administration using only approved API operations.

## Prerequisites/dependencies
Complete tasks 05, 06, and 07.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 6. Can run in parallel with tasks 08, 10, and 11; keep ownership limited to alerts/decisions files.

## Owner
Next.js dashboard agent.

## Files and artifacts
- Implement alert list/detail routes and components.
- Implement decision list/detail routes and components.
- Add only matrix-approved mutation controls.
- Add reusable filter, pagination, confirmation, and operation-result behavior.

## Implementation steps
1. Map UI filters, supported page-size or page-mode fields, sort, and inspect identifiers to validated API fields; do not invent cursor or offset behavior.
2. Preserve filter/pagination state across refresh and detail navigation where appropriate.
3. Render readable tables and details for empty, partial, unsupported, and failed responses.
4. Identify the exact CrowdSec action for every mutation.
5. Require explicit confirmation for deletion or multi-item changes and refresh source-of-truth data after success.
6. Never display raw command construction or allow command text in forms.

## Contracts
- Alerts and decisions use only matrix-approved typed fields, filters, page modes, and mutations; generic cursor/offset behavior is forbidden where the matrix does not support it.
- The matrix defines `alerts.inspect` but no `decisions.inspect`; decision detail must remain list-based unless an approved requirements and matrix change adds that operation.
- Decision mutations are limited to matrix fields and protections: no delete-by-ID, bulk delete, `--all`, `--origin`, `--scenario`, or `--bypass-allowlist` behavior.
- Mutations require server-side confirmation and refresh the matrix-defined affected decision data after success.

## Acceptance criteria
- List/detail behavior matches task 02 and task 03.
- Invalid filter/page inputs are rejected or normalized predictably.
- Unsupported mutations are absent or visibly unavailable.
- Destructive actions require confirmation and show success/failure status.
- Errors never expose credentials, tokens, or unsafe shell details.

## Verification
- Test filtering, pagination, detail loading, no-results, stale data, command failure, and successful mutation flows.
- Verify confirmation is required before every destructive/multi-item action.
- Check API requests against the command matrix.

## Reviewer
Next.js dashboard developer and Backend Developer.

## Out of scope
Unapproved CrowdSec mutations, direct database access, real-time streaming, and new backend endpoints not defined in task 03.

## Coordinator status
- Status: completed
- Completed by: Next.js dashboard agent (coordinator-reviewed; coordinator resolved a shared-config blocker left by task 11's `output: "export"` change and followed up on the agent's truncated output)
- Completed at: 2026-08-12T14:35:00Z
- Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` all passed in `frontend/` (13 static routes; `/alerts` 4.59 kB, `/decisions` 4.03 kB). Alerts page uses `alerts.list` (limit-only page mode, no cursor/offset invented) + `alerts.inspect`; decisions page uses `decisions.list` + `decisions.add`/`decisions.delete` mutations. Every mutation goes through the two-step `useMutation` flow (`issueConfirmation` → `execute`) and renders the server-issued `action` + `command_label` in `ConfirmationModal`. No `decisions.inspect` call (detail stays list-based). No controls for explicitly unsupported rows (`alerts.delete`, `decisions.import`, delete-by-ID, `--all`, `--origin`, `--scenario`, `--bypass-allowlist`). Static search confirms no shell/exec/flag construction and no command text in browser requests. The shared-config blocker (task-11 `output: "export"` vs `icon.tsx` `next/og` `ImageResponse`) was resolved by the coordinator by replacing `icon.tsx` with a static `icon.svg` (asset-delivery boundary fix); the alerts/decisions files themselves are clean.
- Commit or artifact reference: frontend/src/app/(dashboard)/alerts/page.tsx, frontend/src/app/(dashboard)/alerts/_components/ (alerts-filters.tsx, alerts-table.tsx, alert-detail.tsx), frontend/src/app/(dashboard)/decisions/page.tsx, frontend/src/app/(dashboard)/decisions/_components/ (decisions-filters.tsx, decisions-table.tsx, decision-add-form.tsx, decision-delete-form.tsx, operation-outcome.ts); working tree
