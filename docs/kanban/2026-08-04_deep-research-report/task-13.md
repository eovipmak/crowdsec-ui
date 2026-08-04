# Task 13 — Perform cross-artifact security and scope review

## Objective
Gate MVP completion by checking that code, contracts, UI, deployment, and documentation remain consistent and safe.

## Prerequisites
Complete tasks 02, 03, 04, 06, 09, 10, 11, and 12.

## Owner
Review agent. Reviewers: Development Lead, Security reviewer, and CrowdSec domain reviewer.

## Files and artifacts
- Create a review record under `docs/` listing checks, findings, severity, owner, remediation, and sign-off.
- Route code or documentation fixes to the owning task; do not silently broaden scope.

## Review checklist
1. Every executable operation is present in the command matrix and uses typed allowlisted arguments.
2. No shell interpolation, arbitrary command endpoint, browser-controlled executable path, or direct CrowdSec database access exists.
3. API, adapter, UI controls, and docs agree on names, parameters, errors, pagination, and mutations.
4. Authentication uses one local admin, strong password hashing, expiring protected sessions, logout invalidation, and mutation authorization.
5. Passwords, tokens, hashes, and sensitive command output are absent from logs, errors, examples, and bundles.
6. Bind defaults, service account, config permissions, systemd unit, and filesystem layout follow least privilege.
7. Destructive or multi-item changes require confirmation and refresh source-of-truth data.
8. No application database, containers, CI/CD, Prometheus/Grafana, notifications, backup system, or expanded identity system slipped into scope.

## Acceptance criteria
- All high-severity findings are fixed and re-reviewed.
- Matrix, architecture, API, implementation, package, and docs are internally consistent.
- Explicit reviewer sign-offs are recorded.
- Remaining limitations are documented rather than hidden behind unsupported behavior.

## Verification
- Run repository build, lint, typecheck, formatting, and available focused checks.
- Perform a static search for forbidden scope items and unsafe command execution patterns.
- Walk through login, read, mutation, failure, packaging, and troubleshooting flows.

## Out of scope
Adding new features, formal penetration testing, deployment to shared infrastructure, destructive cleanup, and changing requirements without a new approved plan.
