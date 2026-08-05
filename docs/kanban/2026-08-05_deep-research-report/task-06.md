# Task 06 — Implement single-admin authentication and session security

## Objective
Protect the dashboard with one local administrator account and secure expiring sessions.

## Prerequisites/dependencies
Complete tasks 03 and 05.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 6. Can run in parallel with tasks 08, 09, 10, and 11 once their own prerequisites are met; owns authentication/security files.

## Owner
Single-admin security agent.

## Files and artifacts
- Implement credential configuration/loading and password hashing.
- Implement login, logout, session validation, expiration, and mutation authorization.
- Add transport-appropriate CSRF protection and secure cookie/token settings.
- Update configuration and API documentation if implementation decisions require precise additions.

## Implementation steps
1. Store only a strong password hash and minimal administrator/server configuration; never store plaintext passwords.
2. Define secure initial setup behavior that does not create a default discoverable password.
3. Protect all non-public routes and require an authenticated administrator for mutations.
4. Use expiring, unguessable sessions with invalidation on logout and safe cookie attributes when cookies are used.
5. Apply CSRF protection for cookie-authenticated state changes or document the equivalent token model.
6. Normalize login failure responses to avoid account enumeration.
7. Ensure credentials, session tokens, hashes, and sensitive command output never reach logs or errors.

## Contracts
- One local administrator is represented by a strong password hash and minimal configuration; plaintext passwords, tokens, hashes, and sensitive command output never enter logs or responses.
- Every non-public route and every matrix mutation is protected server-side; mutations include decisions, allowlists, machine pruning, and conditional bouncer deletion.
- Session expiration, logout invalidation, replay resistance, cookie/token settings, and CSRF protection follow the API contract.
- Destructive or multi-item mutations require a server-validated confirmation bound to the typed operation and request; frontend confirmation alone is insufficient.

## Acceptance criteria
- Protected routes reject missing, expired, invalid, and logged-out sessions.
- Login/logout behavior matches task 03.
- Mutation endpoints cannot be called anonymously or without required confirmation.
- No LDAP, OIDC, RBAC, user management, or multi-admin behavior is added.
- Security defaults are safe for localhost/trusted-network deployment.

## Verification
- Exercise valid/invalid login, expiry, logout, replay, CSRF, and mutation authorization paths.
- Inspect logs and responses for secret leakage.
- Review cookie/token flags and password-hash parameters.

## Reviewer
Security reviewer.

## Out of scope
External identity providers, role systems, DDoS-oriented rate limiting, HTTPS termination, and account recovery workflows beyond documented local administration.
