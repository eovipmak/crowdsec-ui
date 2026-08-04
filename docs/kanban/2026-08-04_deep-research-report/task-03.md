# Task 03 — Define architecture, API contracts, and configuration schema

## Objective
Specify stable boundaries so backend, frontend, security, and deployment agents can work in parallel without inventing interfaces.

## Prerequisites
Complete tasks 01 and 02.

## Owner
Architecture agent. Reviewers: Development Lead and Security reviewer.

## Files and artifacts
- Create or update the architecture document under `docs/`.
- Define API contract documentation and example JSON payloads.
- Define the local configuration schema and sample configuration shape.

## Work
1. Document browser → authenticated HTTP server → adapter → `cscli` → CrowdSec flow.
2. Define route naming, HTTP methods, auth requirements, request validation, status codes, JSON success/error envelopes, pagination/filter query fields, and mutation confirmation fields.
3. Define endpoints for all matrix-approved operations, including health and session endpoints.
4. Define configuration fields for `cscli` path, optional CrowdSec config path, bind address, port, administrator credential material, session expiration, and logging.
5. Define frontend asset delivery for development and native production packaging.
6. Define typed boundaries between handlers, authentication, configuration, command execution, and adapter operations.

## Acceptance criteria
- API examples are sufficient for a frontend agent to build against without backend guesswork.
- Config fields have defaults, required/optional status, validation, and secret-handling rules.
- The architecture diagram matches the no-database and strict-allowlist constraints.
- Read, mutation, error, and authentication behavior is unambiguous.

## Verification
- Cross-check every API operation against task 02.
- Check that no endpoint accepts command text, executable paths, or arbitrary flags from the browser.
- Review config examples for secrets and unsafe bind defaults.

## Out of scope
Implementation of the server, adapter, authentication, UI, systemd, or installation procedures.
