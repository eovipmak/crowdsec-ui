# Task 06 — Implement single-admin authentication and session security

## Objective
Protect the dashboard with one local administrator account and secure expiring sessions.

## Prerequisites
Complete tasks 03 and 05.

## Owner
Single-admin security agent. Reviewer: Security reviewer.

## Files and artifacts
- Implement credential configuration/loading and password hashing.
- Implement login, logout, session validation, expiration, and mutation authorization.
- Add transport-appropriate CSRF protection and secure cookie/token settings.
- Update configuration and API documentation if implementation decisions require precise additions.

## Work
1. Store only a strong password hash and minimal administrator/server configuration; never store plaintext passwords.
2. Define secure initial setup behavior that does not create a default discoverable password.
3. Protect all non-public routes and require an authenticated administrator for mutations.
4. Use expiring, unguessable sessions with invalidation on logout and safe cookie attributes when cookies are used.
5. Apply CSRF protection for cookie-authenticated state changes or document the equivalent token model.
6. Normalize login failure responses to avoid account enumeration.
7. Ensure credentials, session tokens, hashes, and sensitive command output never reach logs or errors.

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

## Out of scope
External identity providers, role systems, DDoS-oriented rate limiting, HTTPS termination, and account recovery workflows beyond documented local administration.
