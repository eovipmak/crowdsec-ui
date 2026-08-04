# Task 09 — Implement alerts and decisions workflows

## Objective
Implement searchable, filterable, paginated alert and decision administration using only approved API operations.

## Prerequisites
Complete tasks 05, 06, and 07.

## Owner
Next.js dashboard agent. Reviewers: Next.js dashboard developer and Backend Developer.

## Files and artifacts
- Implement alert list/detail routes and components.
- Implement decision list/detail routes and components.
- Add only matrix-approved mutation controls.
- Add reusable filter, pagination, confirmation, and operation-result behavior.

## Work
1. Map UI filters, page size, cursor/offset, sort, and inspect identifiers to validated API fields.
2. Preserve filter/pagination state across refresh and detail navigation where appropriate.
3. Render readable tables and details for empty, partial, unsupported, and failed responses.
4. Identify the exact CrowdSec action for every mutation.
5. Require explicit confirmation for deletion or multi-item changes and refresh source-of-truth data after success.
6. Never display raw command construction or allow command text in forms.

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

## Out of scope
Unapproved CrowdSec mutations, direct database access, real-time streaming, and new backend endpoints not defined in task 03.
