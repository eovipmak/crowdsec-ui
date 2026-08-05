# Task 05 — Implement the Go HTTP backend and static asset boundary

## Objective
Expose the approved adapter operations through the contract from task 03 and serve the frontend in native deployment.

## Prerequisites/dependencies
Complete tasks 03 and 04.

If any prerequisite is missing or ambiguous, stop, report the blocker with the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 5. Depends on the adapter and contracts; can run in parallel with task 07, but must not alter authentication implementation.

## Owner
Go backend agent.

## Files and artifacts
- Implement `net/http` server, routing, middleware hooks, handlers, JSON encoding, validation, and health endpoint.
- Connect handlers to configuration and the strict adapter.
- Implement the defined frontend asset serving boundary.
- Add secret-safe structured logging.

## Implementation steps
1. Implement all matrix-approved read and mutation routes.
2. Validate path/query/body parameters and reject unknown or unsupported fields.
3. Return the exact success/error envelopes and status codes from task 03.
4. Enforce pagination/filter bounds and map requests to typed adapter operations.
5. Provide startup, config-error, command-failure, and communication-error logs without secrets.
6. Serve the production frontend assets according to the packaging contract while preserving API routing.
7. Leave authentication middleware attachable before protected routes are considered complete.

## Contracts
- Routes exist only for supported or capability-gated matrix operations plus explicitly defined health and session routes; unsupported matrix rows never become functional endpoints.
- Handlers use the exact task-03 status codes and envelopes, reject unknown fields and unsupported query parameters, and pass only typed validated requests to the adapter.
- Health and session routes are fixed application routes and must not become generic command endpoints.
- Static asset delivery cannot expose configuration files, profiles, executable paths, raw command lines, or raw command output, and cannot shadow API routes.
- Authentication remains attachable before protected routes are complete; secret-safe logging is mandatory at this boundary.

## Acceptance criteria
- Routes and payloads match task 03 exactly.
- Malformed, unsupported, and unauthorized inputs produce deterministic responses.
- Adapter errors remain safe and actionable.
- The server starts with valid configuration and exits clearly for invalid configuration.
- Asset serving cannot shadow API routes or expose configuration files.

## Verification
- Run the repository’s Go formatting, build, and available checks.
- Exercise health, read, mutation, malformed-request, and adapter-failure paths.
- Verify static asset requests and unknown-route behavior.

## Reviewer
Go backend developer and Security reviewer.

## Out of scope
Authentication implementation, UI pages, systemd, arbitrary command endpoints, and application persistence.
