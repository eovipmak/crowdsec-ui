# Task 02 — Extend alerts.list / decisions.list contract for the v2 table + filters

## Objective
The alert and decision tables must mirror the cscli `-m` table format the
operator already relies on (`cscli alerts list -m`, `cscli decisions list`).
Today the Go `AlertItem` and `DecisionItem` only surface a subset of those
fields, and the typed filters include `scope`/`kind` (alerts) and
`origin`/`scope` (decisions) that the operator wants removed from the UI.
This task publishes the v2 contract — parsed fields, filter fields, and
argument vectors — so tasks 03 and 04 can implement the UI changes against a
fixed backend contract. This task does NOT implement the UI.

Reference columns under each command (from the plan):

`cscli alerts list -m`:
`ID | value | reason | country | as | decisions | created_at | kind | machine`

`cscli decisions list`:
`ID | Source | Scope:Value | Reason | Action | Country | AS | Events | expiration | Alert ID`

## Prerequisites/dependencies
None (the Discovery/Contracts task can begin in parallel with task 01 as
long as it does not touch `probe.go`). If task 01 is incomplete, the metrics
fields the alert/decision JSON may carry are unaffected — alert/decision JSON
shape depends only on `alerts.list` / `decisions.list`, not on metrics.

If any prerequisite is missing or ambiguous, stop, report the blocker with
the missing artifact/task, and do not guess or implement around it.

## Parallelization

Wave 1. Discovery + contracts. Tasks 03 and 04 MUST wait for this task to
land its contract decisions (filter fields removed, parsed fields added).
Does not conflict with task 01 (different file: `probe.go` is untouched
here) or task 05 (scenarios removal — different files entirely).

## Owner
Go cscli backend agent (contract owner).

## Files and artifacts
- `backend/internal/adapter/types.go` — extend parsed-shape structs only.
- `backend/internal/adapter/parse.go` — extend cscli-JSON parser decoders
  for the newly surfaced fields.
- `backend/internal/adapter/validation.go` / `args.go` — drop the removed
  filter fields from the validation/argument-builder functions exactly as
  specified in this task.
- `backend/internal/adapter/adapter_test.go` and any `testdata/` fixtures —
  add cases covering the expanded parsed shape and the trimmed filters.
- Do NOT touch `frontend/**`; the front-end tasks consume the contract.
- Do NOT invent new operations, endpoints, or matrix rows.

## Implementation steps
1. Discovery (no code change): inspect what `cscli alerts list -o json` and
   `cscli decisions list -o json` actually emit on the verified cscli 1.7.8
   described in `docs/command-matrix.md`. Record the field namesactually
   returned for: country, as (autonomous system), events count, machine,
   kind, reason, alert_id, source, expiration/duration. Use the existing
   `cscliDecisionsEntry`/`cscliEmbeddedDecision` and `parseJSONCollection`
   decoders as the authoritative source of what the dashboard already maps,
   then extend — do not rewrite.
2. Extend the parsed types:
   - `AlertItem`: add the additional fields surfaced in the cscli alert JSON:
     `Country`, `AS` (rename to be Go-idiomatic and JSON-stable, e.g.
     `country`, `as_owner` or `as`); `EventsCount`/`machine`, `kind`,
     `reason` if the JSON carries them. Use `omitempty` for new optional
     fields. Do not rename the existing fields (`id`, `start_at`,
     `scenario`, `scope`, `value`, `decisions`) — tasks 03/04 rely on them.
   - `DecisionItem`: add the additional fields surfaced in the cscli
     decision JSON that the CSLogo `-m` table shows: `events` (count),
     `alert_id` if available, and confirm `origin` and `expiration`/
     `duration` mappings. Use `omitempty` for new optional fields.
3. Extend the cscli decoders in `parse.go` to populate the new fields from
   the JSON. The flat-decision fallback (`tryParseFlatDecisions`) must
   continue to work; do not break the existing alert-blob path. Malformed
   JSON remains `malformed_output`; an empty list is `items: []`.
4. Drop the removed filter fields:
   - Alerts: remove `Scope` and `Kind` from `AlertsFilter` (the typed
     request struct and validation/args). Keep `Scenario` and `IP`.
   - Decisions: remove `Origin` and `Scope` from `DecisionsFilter` (the
     typed request struct and validation/args). Keep `IP`, `Type`,
     `Scenario`.
5. Update `args.go`:
   - `alertsListArgs` must stop emitting `--scope` and `--kind`; keep
     `--scenario` and `--ip` (or the matching `<value>` form already used).
   - `decisionsListArgs` must stop emitting `--origin` and `--scope`; keep
     `--ip`, `--type`, `--scenario`.
   - The plan describes the IP filter as `cscli alerts list -a | grep
     <ip>` and `cscli decisions list -a | grep <ip>` — if the existing code
     already passes the IP via `-a` (limited/all) or `--ip`/`-i`, preserve
     the current behavior; do NOT invent a new flag.
6. Update `validateAlertsFilters` and `validateDecisionsFilters` to reject
   no-longer-supported fields (defense in depth: any client sending the
   removed field should be ignored, not error, to avoid breaking cached
   browser requests during the rollout). Document this in code comments.
7. Add unit-test coverage in `adapter_test.go` for: the expanded parsed
   fields populated from a JSON fixture; the trimmed filters no longer
   producing `--scope`/`--kind`/`--origin` arguments; the flat-decision
   fallback still working.
8. Do not change any API envelope shape, status code, route, or capability
   gating; the public `/api/v1/alerts` and `/api/v1/decisions` endpoints and
   their requests must remain backward compatible except for the dropped
   filter fields.

## Contracts
- `GET /api/v1/alerts?limit=N&filter.scenario=...&filter.ip=...` still works;
  `filter.scope` and `filter.kind` are ignored (not rejected) so the rollout
  is safe. The response `AlertItem[]` MAY include new optional fields:
  `country`, `as_owner` (or chosen name), `events`, `machine`, `kind`,
  `reason`. The UI renders known fields only.
- `GET /api/v1/decisions?limit=N&filter.ip=...&filter.type=...&filter.scenario=...`
  still works; `filter.origin` and `filter.scope` are ignored. The response
  `DecisionItem[]` MAY include new optional fields: `events`, `alert_id`,
  and confirms `origin`/`expiration`/`duration`.
- `POST /api/v1/decisions/add` and `DELETE /api/v1/decisions` mutations are
  unchanged.
- No new endpoints, no new matrix rows, no schema break for existing
  consumers.

## Acceptance criteria
- A `cscli alerts list -o json` fixture exercises the new fields and they
  appear in the parsed `AlertItem[]` (no data loss, no panic).
- A `cscli decisions list -o json` fixture exercises the new fields and they
  appear in the parsed `DecisionItem[]`.
- `alertsListArgs` no longer emits `--scope` or `--kind`;
  `decisionsListArgs` no longer emits `--origin` or `--scope`.
- Stale client requests carrying the dropped filter fields are ignored, not
  rejected with an error.
- `go test ./backend/internal/adapter/...` and `go test ./backend/internal/api/...`
  pass; existing tests that referenced `Scope`/`Kind`/`Origin` in the alert
  or decision filter are updated to the new contract.

## Verification commands/checks
- `gofmt -l backend/`
- `go vet ./backend/...`
- `go build ./backend/...`
- `go test ./backend/internal/adapter/... ./backend/internal/api/...`
- Manual: confirm via the api endpoint (with auth) that the parsed JSON now
  includes the additional fields when cscli returns them, and that the removed
  filter query params no longer affect the cscli argv.

## Reviewer
Go backend developer and Next.js dashboard developer (contract consumer).

## Out of scope
- Frontend table/filter UI changes (tasks 03 and 04).
- Removing the Scenarios/Profiles/Collections UI (task 05).
- Metrics probe fix (task 01).
- New backend endpoints, schema-breaking changes, or new matrix rows.

## Coordinator status
- Status: completed
- Completed by: go-cscli-backend agent (DeepSeek-V4-Flash-0731) + coordinator review
- Completed at: 2026-08-13T00:00:00Z
- Verification: `gofmt -l backend/` clean except pre-existing `internal/assets/assets.go` (out of scope); `go vet ./...` pass; `go build ./...` pass; `go test ./internal/adapter/... ./internal/api/...` pass (ok adapter, ok api). Verbosely ran `TestAlertsListSurfacesNewFields`, `TestDecisionsListSurfacesNewFieldsAndBlobFallback`, `TestDecisionsListFlatFallbackStillWorks`, `TestAlertsListDropsScopeAndKindFilters`, `TestDecisionsListDropsScopeAndOriginFilters`, `TestAlertsListIgnoresDroppedScopeAndKindFilters`, `TestDecisionsListIgnoresDroppedOriginAndScopeFilters` — all PASS. Static check: `--scope`/`--kind`/`--origin` only appear in args.go comments, no executable argv. Deviations from allowed-files: `handlers.go` (validators `validateAlertsFilters`/`validateDecisionsFilters` actually live here, no validation.go exists) and `api/validate.go` (defense-in-depth: keeps dropped query keys in `allowedQueryParams` so stale cached requests don't 400; `decodeAlertsList`/`decodeDecisionsList` ignore them) — both align with the contract's 'ignored, not rejected' requirement. probe.go and frontend untouched (preserved task 01/03/04 boundaries).
- Commit or artifact reference: working tree (uncommitted). Modified: backend/internal/adapter/{types,parse,args,handlers,adapter_test}.go, backend/internal/api/{validate,api_test}.go. Surfaced JSON fields: AlertItem adds {country, as_number, as_name, events, machine, kind, reason, created_at}; DecisionItem adds {events, alert_id, country, as_number, as_name}. Filters trimmed: AlertsFilter={scenario?, ip?}, DecisionsFilter={ip?, type?, scenario?}.
