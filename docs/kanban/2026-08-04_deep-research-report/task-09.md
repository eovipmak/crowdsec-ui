# Task 09 — Implement alerts and decisions workflows

## Objective
Implement searchable, filterable, paginated alert and decision administration using only approved API operations.

## Prerequisites
Complete tasks 05, 06, and 07.

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
