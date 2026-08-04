# Task 10 — Implement component, allowlist, and bouncer administration views

## Objective
Display and manage scenarios, profiles, collections, allowlists, and bouncers according to the validated command matrix.

## Prerequisites
Complete tasks 05, 06, and 07.

## Owner
Next.js dashboard agent. Reviewers: Next.js dashboard developer and CrowdSec domain reviewer.

## Files and artifacts
- Implement pages/components for scenarios, profiles, collections, allowlists, and bouncers.
- Add typed forms only for approved mutations.
- Add confirmation and operation-status UI for changes.

## Work
1. Separate read-only configuration display from supported management actions.
2. Use constrained selects, identifiers, and typed fields; never accept command strings or arbitrary flags.
3. Show the mapped CrowdSec command/action conceptually without exposing unsafe execution details.
4. Require confirmation for enable/disable, deletion, or changes affecting multiple items.
5. Refresh the relevant list after successful changes and preserve safe error details after failure.
6. Clearly mark environment-dependent or unsupported capabilities.

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

## Out of scope
New command discovery, arbitrary configuration editing, direct file/database manipulation, and monitoring integrations.
