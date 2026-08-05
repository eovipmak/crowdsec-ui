# Task 13 — Perform cross-artifact security and scope review

## Objective
Gate MVP completion by checking that code, contracts, UI, deployment, and documentation remain consistent and safe.

## Prerequisites/dependencies
Complete tasks 02, 03, 04, 06, 09, 10, 11, and 12.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 8. Final gate; runs after all required artifacts are available and must route fixes to owning tasks.

## Owner
Review agent.

## Files and artifacts
- Create a review record under `docs/` listing checks, findings, severity, owner, remediation, and sign-off.
- Route code or documentation fixes to the owning task; do not silently broaden scope.

## Implementation steps
1. Every executable operation is present in the command matrix and uses typed allowlisted arguments.
2. No shell interpolation, arbitrary command endpoint, browser-controlled executable path, or direct CrowdSec database access exists.
3. API, adapter, UI controls, and docs agree on names, parameters, errors, pagination, and mutations.
4. Authentication uses one local admin, strong password hashing, expiring protected sessions, logout invalidation, and mutation authorization.
5. Passwords, tokens, hashes, and sensitive command output are absent from logs, errors, examples, and bundles.
6. Bind defaults, service account, config permissions, systemd unit, and filesystem layout follow least privilege.
7. Destructive or multi-item changes require confirmation and refresh source-of-truth data.
8. No application database, containers, CI/CD, Prometheus/Grafana, notifications, backup system, or expanded identity system slipped into scope.

## Contracts
- The review record is the final cross-artifact gate and must trace findings to requirements, matrix rows, API contracts, code, UI controls, deployment, and documentation.
- Review explicitly checks the profiles-reader boundary versus the `cscli`-only requirement, the absence of `decisions.inspect`, command-specific pagination, unsupported component mutations, and capability/sign-off status.
- Findings include severity, owner, remediation, and status; high-severity findings require fixes and re-review. Review cannot silently broaden scope or invent unsupported operations.

## Acceptance criteria
- All high-severity findings are fixed and re-reviewed.
- Matrix, architecture, API, implementation, package, and docs are internally consistent.
- Explicit reviewer sign-offs are recorded.
- Remaining limitations are documented rather than hidden behind unsupported behavior.

## Verification
- Run repository build, lint, typecheck, formatting, and available focused checks.
- Perform a static search for forbidden scope items and unsafe command execution patterns.
- Walk through login, read, mutation, failure, packaging, and troubleshooting flows.

## Reviewer
Development Lead, Security reviewer, and CrowdSec domain reviewer.

## Out of scope
Adding new features, formal penetration testing, deployment to shared infrastructure, destructive cleanup, and changing requirements without a new approved plan.
