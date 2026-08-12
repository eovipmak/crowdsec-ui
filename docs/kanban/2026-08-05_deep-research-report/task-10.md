# Task 10 — Implement component, allowlist, and bouncer administration views

## Objective
Display and manage scenarios, profiles, collections, allowlists, and bouncers according to the validated command matrix.

## Prerequisites/dependencies
Complete tasks 05, 06, and 07.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 6. Can run in parallel with tasks 08, 09, and 11; keep ownership limited to component/allowlist/bouncer files.

## Owner
Next.js dashboard agent.

## Files and artifacts
- Implement pages/components for scenarios, profiles, collections, allowlists, and bouncers.
- Add typed forms only for approved mutations.
- Add confirmation and operation-status UI for changes.

## Implementation steps
1. Separate read-only configuration display from supported management actions.
2. Use constrained selects, identifiers, and typed fields; never accept command strings or arbitrary flags.
3. Show the mapped CrowdSec command/action conceptually without exposing unsafe execution details.
4. Require confirmation for enable/disable, deletion, or changes affecting multiple items.
5. Refresh the relevant list after successful changes and preserve safe error details after failure.
6. Clearly mark environment-dependent or unsupported capabilities.

## Contracts
- Scenarios, collections, hub inventory, and profiles are read-only in the MVP; no functional controls may be created for explicitly unsupported install/remove or component enable/disable rows.
- Profiles use only the approved read-only profiles-file boundary, never profile editing or arbitrary expressions.
- Allowlists support only typed local create/add/remove/delete operations; Console-managed entries remain read-only. Bouncers support listing and conditional local deletion only when capability probing permits it.
- Names, IP/CIDR values, descriptions, durations, and other fields use the validators and confirmation rules in `docs/command-matrix.md`.

## Acceptance criteria
- Every visible control maps to a task-02 matrix row.
- Unsupported actions cannot appear functional.
- Successful mutations refresh current CrowdSec data.
- Errors are readable, secret-safe, and scoped to the affected operation.
- No local database or client-side source-of-truth copy is introduced.

## Verification
- Test list rendering, empty/unsupported states, validation, confirmation, success refresh, and command failure.
- Compare every form field with the allowed parameter list.
- Verify mutation controls require an authenticated session.

## Reviewer
Next.js dashboard developer and CrowdSec domain reviewer.

## Out of scope
New command discovery, arbitrary configuration editing, direct file/database manipulation, and monitoring integrations.

## Coordinator status
- Status: completed
- Completed by: Next.js dashboard agent (coordinator-reviewed; coordinator finished the bouncers page the agent truncated mid-flow and applied Prettier to the agent's new files)
- Completed at: 2026-08-12T14:35:00Z
- Verification: `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` all passed in `frontend/` (13 static routes; `/scenarios` 4.19 kB, `/allowlists` 5.26 kB, `/bouncers` 2.05 kB). Scenarios/collections/hub/profiles/simulation are READ-ONLY (no install/remove/enable-disable controls; `scenarios.install`, `collections.install`, `collections.remove`, `hub.update`, `simulation.enable`, `simulation.disable` render no functional control). Profiles use only the read-only `profiles.inspect` boundary (no editing, no expression input). Allowlists support only typed `allowlists.create`/`add`/`remove`/`delete` mutations through the two-step `useMutation` flow with `ConfirmationModal`; `allowlists.import` is absent; Console-managed entries remain read-only. Bouncers list + conditional `bouncers.delete` only when capability permits (else omitted with a `CapabilityBadge` notice); the bouncer token is never accepted or displayed; `bouncers.add` is absent. Static search confirms no shell/exec/flag construction and no command text in browser requests. No backend, docs, or other-task files modified.
- Commit or artifact reference: frontend/src/app/(dashboard)/scenarios/page.tsx, frontend/src/app/(dashboard)/scenarios/_components/ (scenarios-table.tsx, collections-table.tsx, hub-inventory.tsx, profiles-view.tsx, simulation-status-card.tsx), frontend/src/app/(dashboard)/allowlists/page.tsx, frontend/src/app/(dashboard)/allowlists/_components/ (allowlists-table.tsx, allowlist-create-form.tsx, allowlist-add-entry-form.tsx, allowlist-check-card.tsx, allowlist-delete-modal.tsx, allowlist-remove-entry-modal.tsx, operation-outcome.ts, validation.ts), frontend/src/app/(dashboard)/bouncers/page.tsx, frontend/src/app/(dashboard)/bouncers/_components/ (bouncers-table.tsx, bouncer-delete-modal.tsx, operation-outcome.ts); working tree
