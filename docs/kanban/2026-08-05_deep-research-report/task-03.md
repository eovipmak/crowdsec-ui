# Task 03 — Define architecture, API contracts, and configuration schema

## Objective
Specify stable boundaries so backend, frontend, security, and deployment agents can work in parallel without inventing interfaces.

## Prerequisites/dependencies
Complete tasks 01 and 02.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 3. Starts after tasks 01–02; its contracts unblock tasks 04, 05, 06, and 07.

## Owner
Architecture agent.

## Files and artifacts
- Create or update the architecture document under `docs/`.
- Define API contract documentation and example JSON payloads.
- Define the local configuration schema and sample configuration shape.

## Implementation steps
1. Document browser → authenticated HTTP server → adapter → `cscli` → CrowdSec flow.
2. Define route naming, HTTP methods, auth requirements, request validation, status codes, JSON success/error envelopes, pagination/filter query fields, and mutation confirmation fields.
3. Define endpoints for all matrix-approved operations, including health and session endpoints.
4. Define configuration fields for `cscli` path, optional CrowdSec config path, bind address, port, administrator credential material, session expiration, and logging.
5. Define frontend asset delivery for development and native production packaging.
6. Define typed boundaries between handlers, authentication, configuration, command execution, and adapter operations.

## Contracts
- The architecture and API documents define a one-to-one mapping from functional API operations to supported or capability-gated matrix rows; unsupported component install/remove, profile editing, arbitrary configuration, notification, and Console-management endpoints are prohibited.
- Responses use the matrix envelope: fixed `operation`, typed `request`, typed `result` or safe `error`, and a fixed operation label in `source.command` that never exposes the executed argument vector.
- Mutation confirmation is server-verifiable and bound to the operation and typed request, not a frontend-only flag.
- Configuration paths are server-side settings only. An optional CrowdSec configuration path may support the approved read-only profiles-file boundary but cannot become browser-controlled command input or an editing facility.

## Acceptance criteria
- API examples are sufficient for a frontend agent to build against without backend guesswork.
- Config fields have defaults, required/optional status, validation, and secret-handling rules.
- The architecture diagram matches the no-database and strict-allowlist constraints.
- Read, mutation, error, and authentication behavior is unambiguous.

## Verification
- Cross-check every API operation against task 02.
- Check that no endpoint accepts command text, executable paths, or arbitrary flags from the browser.
- Review config examples for secrets and unsafe bind defaults.

## Reviewer
Development Lead and Security reviewer.

## Out of scope
Implementation of the server, adapter, authentication, UI, systemd, or installation procedures.

## Coordinator status
- Status: completed
- Completed by: Architecture agent
- Completed at: 2026-08-12T00:00:00Z
- Verification: `docs/architecture.md` cross-checked against `docs/command-matrix.md` §4 — 35 matrix rows, 24 supported/capability-gated endpoints with one-to-one method/page-mode/confirmation/refresh mapping, 11 unsupported rows with no endpoint (404), 6 fixed application routes; no-database and strict-allowlist constraints preserved; config schema has safe defaults (bind `127.0.0.1`, no default password hash); `git diff --check` clean.
- Commit or artifact reference: docs/architecture.md; working tree
