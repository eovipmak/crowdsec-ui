# Task 12 — Write administrator, installation, and troubleshooting documentation

## Objective
Provide complete handover documentation for installation, configuration, daily administration, and failed `cscli` operations.

## Prerequisites/dependencies
Complete tasks 02, 03, 06, 09, 10, and 11.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 7. Starts after the command/API/security/UI/deployment artifacts it documents are available.

## Owner
Documentation agent.

## Files and artifacts
- Installation and native deployment guide.
- Configuration and single-admin setup guide.
- Administrator usage guide for every MVP page.
- Troubleshooting guide for startup, auth, permissions, missing commands, invalid output, timeouts, and CrowdSec failures.
- Update/start/stop/restart procedures.

## Implementation steps
1. Explain the single-host source-of-truth model and supported command limitations.
2. Document package layout, config fields, permissions, service account, bind defaults, and HTTPS boundary.
3. Document secure initial administrator setup, login/logout, sessions, and mutation confirmation.
4. Describe each page, filter, detail view, refresh behavior, and supported mutation.
5. Provide safe troubleshooting steps using logs and `cscli` diagnostics without requesting secrets.
6. Document direct execution and systemd procedures, including update and rollback-safe operator steps without destructive shortcuts.
7. List explicit non-goals: database backup, monitoring platforms, notifications, containers, and multi-user identity.

## Contracts
- Documentation must distinguish supported, capability-gated, and explicitly unsupported operations and must match the command matrix, API contracts, implementation, and package layout.
- Troubleshooting uses only safe error classes: `unsupported`, `malformed_output`, `permission_denied`, `timeout`, `unavailable`, and `crowdsec_failure`.
- Examples and procedures must not recommend `--force`, `--all`, `--bypass-allowlist`, arbitrary flags, direct database access, or secret disclosure.
- `source.command` is documented as a fixed operation label, not a raw executed command line.

## Acceptance criteria
- An administrator can install, configure, log in, operate every supported page, diagnose failures, and update the service without undocumented assumptions.
- Every command, endpoint, config field, and UI label matches the matrix and implementation contracts.
- Examples contain no real credentials, tokens, or sensitive host data.

## Verification
- Perform a documentation-only walkthrough using a clean-host checklist.
- Cross-reference every command and config key against tasks 02, 03, and 11.
- Confirm troubleshooting advice distinguishes operator fixes from unsupported operations.

## Reviewer
System operator and system administrator.

## Out of scope
New features, unsupported commands, security-policy expansion, CI/CD, backups, monitoring, and notification workflows.

## Coordinator status
- Status: completed
- Completed by: crowdsec-documentation-reviewer agent (coordinator-reviewed)
- Completed at: 2026-08-12T22:10:00Z
- Verification: Four new docs created under `docs/` only — `installation-guide.md` (196 lines, 10 sections), `configuration-guide.md` (100 lines, 7 sections), `administrator-guide.md` (159 lines, 11 sections), `troubleshooting.md` (134 lines, 10 sections). `git status --short` confirms only these four untracked files; no backend Go, frontend TS/TSX, `deploy/`, or `deploy/install/README.md` modified. Cross-reference checks passed: administrator-guide §10 matrix table matches `docs/command-matrix.md` §4 — all supported/capability-gated rows present, all explicitly unsupported rows (`alerts.delete`, `decisions.import`, `machines.delete`, `bouncers.add`, `hub.update`, `scenarios.install`, `collections.install`, `collections.remove`, `simulation.enable`, `simulation.disable`, `allowlists.import`) render no functional control; `decisions.inspect` correctly absent. Configuration-guide §2 fields table cross-references `architecture.md` §8.1 with safe defaults (`server.bind` `127.0.0.1`, no default `admin_password_hash`, `cscli.crowdsec_config_dir` limited to read-only `profiles.inspect`). Troubleshooting §2 uses ONLY the six safe operation error classes (`unsupported`, `malformed_output`, `permission_denied`, `timeout`, `unavailable`, `crowdsec_failure`); HTTP 401/403/409 appear only in auth-failure context matching architecture request-vs-operation code separation. Static search for forbidden tokens (`--force`, `--all`, `--bypass-allowlist`, direct DB access) confirms all 17 matches across `docs/*.md` are negative/prohibitive only — none recommended. `command_label` documented as a fixed operation label, never an executed command line (configuration-guide §5). No real credentials/tokens — only placeholder `choose-a-strong-password` and `$2a$...`/`$argon2id$...` examples. `git diff --check` clean (no whitespace errors). Clean-host installation walkthrough checklist present (installation-guide §9).
- Commit or artifact reference: docs/installation-guide.md, docs/configuration-guide.md, docs/administrator-guide.md, docs/troubleshooting.md; working tree
