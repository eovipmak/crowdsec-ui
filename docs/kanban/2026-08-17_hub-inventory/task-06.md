# Task 06 — Update architecture and operations documentation

## Objective

Update the canonical system documentation (`docs/architecture.md` and `docs/operations-reference.md`) to reflect the new `hub.list` operation, Probe #5, `GET /api/v1/hub` endpoint, probe count (now 5 probes, 15 operations), and frontend navigation/page additions.

## Prerequisites/dependencies

- task-03 COMPLETED (Backend routes and capabilities wired in `main.py`).
- task-05 COMPLETED (Frontend page, nav, and routes wired).

## Owner / recommended agent profile

- Implementer: `crowdsec-command-mapper` / `crowdsec-documentation-reviewer`
- Reviewer: `crowdsec-documentation-reviewer`

## Exact files and artifacts to create or modify

- **MODIFY** `docs/architecture.md` — add `hub.list` to operation catalog, update probe table with Probe #5 (`cscli hub list -o json`), update endpoint list with `/api/v1/hub`, update total operation count (15 ops + health), and verify out-of-scope sections.
- **MODIFY** `docs/operations-reference.md` — document `GET /api/v1/hub` in endpoint tables, request/response schema, query rejection rules, error classifications, and envelope examples.
- **MODIFY (optional)** `deploy/config.example.yaml` — add brief comment that hub inventory respects `cscli.timeout`.

Do NOT modify application code (`backend/*`, `frontend/*`).

## Concrete implementation steps

1. In `docs/architecture.md`:
   - Update summary counts: 15 operations (was 14) + health endpoint.
   - Add `hub.list` to the operation label list.
   - In Startup Capabilities Probes table, add Probe #5:
     - Probe: `cscli hub list -o json`
     - Timeout: 5.0 s
     - Governed Operation: `hub.list`
     - Notes: Validates JSON format and hub CLI support.
   - In HTTP Routes / Endpoints table, add row for `GET /api/v1/hub` (`hub.list`).
   - In Frontend pages section, note the `/hub` Hub Inventory page.
2. In `docs/operations-reference.md`:
   - Add section or table row for `GET /api/v1/hub`:
     - Method: `GET`
     - Path: `/api/v1/hub`
     - Operation: `hub.list`
     - Query Parameters: None accepted (rejects all query params with 400 `invalid_parameters`).
     - Success payload structure (`HubInventory` with collections, parsers, scenarios, postoverflows).
     - Error conditions: `unsupported`, `timeout`, `unavailable`, `crowdsec_failure`, `permission_denied`, `malformed_output`.
     - Envelope JSON example.
   - Update total operation counts and probe table to match `docs/architecture.md`.

## Interfaces/contracts and integration points

- Keeps documentation synchronized with actual backend envelope and frontend route behavior.
- Serves as the single source of truth for API consumers and operators.

## Acceptance criteria

- `docs/architecture.md` and `docs/operations-reference.md` mention `hub.list` and `GET /api/v1/hub`.
- Probe #5 is documented with command `cscli hub list -o json` and timeout `5.0s`.
- Operation counts are consistent (15 operations + health).
- Response and error envelopes for `/hub` match actual implementation.
- No outdated or conflicting references to hub operations being out of scope.

## Verification commands/checks

- `grep -n "hub.list" docs/architecture.md docs/operations-reference.md` → occurrences found in both files.
- `grep -n "/api/v1/hub" docs/architecture.md docs/operations-reference.md` → endpoint documented.
- `grep -rn "Probe #5" docs/` → Probe #5 documented.

## Reviewer

- `crowdsec-documentation-reviewer`

## Explicit out-of-scope

- Code changes in `backend/` or `frontend/`.
- Documenting hypothetical mutation endpoints (`hub upgrade`, `hub update`, `collections install`).
- Adding external documentation for Docker, Kubernetes, or Prometheus exposition.

## Coordinator status
- Status: completed
- Completed by: crowdsec-documentation-reviewer
- Completed at: 2026-08-17T00:00:00Z
- Verification: `grep -n "hub.list" docs/architecture.md docs/operations-reference.md` and `grep -rn "Probe #5" docs/` passed; documentation is fully synchronized with the 15-operation contract and /hub page.
- Commit or artifact reference: working tree
