# Task 07 — Scaffold the Next.js TypeScript dashboard shell

## Objective
Create the frontend foundation and shared interaction patterns required by all dashboard pages.

## Prerequisites/dependencies
Complete tasks 01 and 03.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 4. Can run in parallel with task 04; later page tasks 08–10 depend on this frontend shell.

## Owner
Next.js dashboard agent.

## Files and artifacts
- Create the Next.js/TypeScript application structure.
- Add Tailwind CSS baseline and shared layout/navigation components.
- Add typed API client aligned with task 03.
- Add login route shell and reusable loading, empty, error, confirmation, and operation-status components.

## Implementation steps
1. Create routes/layouts for login, overview, alerts, decisions, machines/status, scenarios/profiles/collections, allowlists, and bouncers.
2. Define shared domain types from the API contract; do not duplicate CrowdSec data into a local application database.
3. Implement authenticated API request behavior, session expiry handling, and safe error rendering.
4. Establish accessible table, filter, pagination, detail, mutation-confirmation, and refresh patterns.
5. Support ordinary page refresh or bounded polling only; do not add streaming or monitoring integrations.

## Contracts
- Routes, shared types, request payloads, and response handling are derived from the task-03 API contract and never expose command construction.
- UI states distinguish supported, optional/environment-dependent, unsupported, empty, loading, error, and expired-session outcomes.
- No functional control is created for matrix rows marked explicitly unsupported, including component install/remove or profile editing.
- The frontend does not persist CrowdSec data in an application database and uses only refresh or bounded polling behavior defined by the API contract.

## Acceptance criteria
- Development and production frontend commands are documented and production build succeeds.
- All planned routes have stable placeholders and shared states.
- API requests cannot send arbitrary command strings or flags.
- Authentication transitions and expired-session behavior are defined.
- No out-of-scope pages or infrastructure are introduced.

## Verification
- Run formatter, lint, typecheck, and production build commands established by the repository.
- Check keyboard navigation and visible error/loading/empty states.
- Verify API client payloads match task 03 examples.

## Reviewer
Next.js dashboard developer.

## Out of scope
Page-specific data workflows, backend implementation, external monitoring, notifications, and application persistence.
