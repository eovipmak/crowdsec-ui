# Task 07 — Scaffold the Next.js TypeScript dashboard shell

## Objective
Create the frontend foundation and shared interaction patterns required by all dashboard pages.

## Prerequisites
Complete tasks 01 and 03.

## Owner
Next.js dashboard agent. Reviewer: Next.js dashboard developer.

## Files and artifacts
- Create the Next.js/TypeScript application structure.
- Add Tailwind CSS baseline and shared layout/navigation components.
- Add typed API client aligned with task 03.
- Add login route shell and reusable loading, empty, error, confirmation, and operation-status components.

## Work
1. Create routes/layouts for login, overview, alerts, decisions, machines/status, scenarios/profiles/collections, allowlists, and bouncers.
2. Define shared domain types from the API contract; do not duplicate CrowdSec data into a local application database.
3. Implement authenticated API request behavior, session expiry handling, and safe error rendering.
4. Establish accessible table, filter, pagination, detail, mutation-confirmation, and refresh patterns.
5. Support ordinary page refresh or bounded polling only; do not add streaming or monitoring integrations.

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

## Out of scope
Page-specific data workflows, backend implementation, external monitoring, notifications, and application persistence.
