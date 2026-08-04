# Task 05 — Implement the Go HTTP backend and static asset boundary

## Objective
Expose the approved adapter operations through the contract from task 03 and serve the frontend in native deployment.

## Prerequisites
Complete tasks 03 and 04.

## Owner
Go backend agent. Reviewer: Go backend developer.

## Files and artifacts
- Implement `net/http` server, routing, middleware hooks, handlers, JSON encoding, validation, and health endpoint.
- Connect handlers to configuration and the strict adapter.
- Implement the defined frontend asset serving boundary.
- Add secret-safe structured logging.

## Work
1. Implement all matrix-approved read and mutation routes.
2. Validate path/query/body parameters and reject unknown or unsupported fields.
3. Return the exact success/error envelopes and status codes from task 03.
4. Enforce pagination/filter bounds and map requests to typed adapter operations.
5. Provide startup, config-error, command-failure, and communication-error logs without secrets.
6. Serve the production frontend assets according to the packaging contract while preserving API routing.
7. Leave authentication middleware attachable before protected routes are considered complete.

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

## Out of scope
Authentication implementation, UI pages, systemd, arbitrary command endpoints, and application persistence.
