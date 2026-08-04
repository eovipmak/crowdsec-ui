# Task 12 — Write administrator, installation, and troubleshooting documentation

## Objective
Provide complete handover documentation for installation, configuration, daily administration, and failed `cscli` operations.

## Prerequisites
Complete tasks 02, 03, 06, 09, 10, and 11.

## Owner
Documentation agent. Reviewers: System operator and system administrator.

## Files and artifacts
- Installation and native deployment guide.
- Configuration and single-admin setup guide.
- Administrator usage guide for every MVP page.
- Troubleshooting guide for startup, auth, permissions, missing commands, invalid output, timeouts, and CrowdSec failures.
- Update/start/stop/restart procedures.

## Work
1. Explain the single-host source-of-truth model and supported command limitations.
2. Document package layout, config fields, permissions, service account, bind defaults, and HTTPS boundary.
3. Document secure initial administrator setup, login/logout, sessions, and mutation confirmation.
4. Describe each page, filter, detail view, refresh behavior, and supported mutation.
5. Provide safe troubleshooting steps using logs and `cscli` diagnostics without requesting secrets.
6. Document direct execution and systemd procedures, including update and rollback-safe operator steps without destructive shortcuts.
7. List explicit non-goals: database backup, monitoring platforms, notifications, containers, and multi-user identity.

## Acceptance criteria
- An administrator can install, configure, log in, operate every supported page, diagnose failures, and update the service without undocumented assumptions.
- Every command, endpoint, config field, and UI label matches the matrix and implementation contracts.
- Examples contain no real credentials, tokens, or sensitive host data.

## Verification
- Perform a documentation-only walkthrough using a clean-host checklist.
- Cross-reference every command and config key against tasks 02, 03, and 11.
- Confirm troubleshooting advice distinguishes operator fixes from unsupported operations.

## Out of scope
New features, unsupported commands, security-policy expansion, CI/CD, backups, monitoring, and notification workflows.
